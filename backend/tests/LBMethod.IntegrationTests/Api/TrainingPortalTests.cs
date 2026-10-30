using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LBMethod.Api.Contracts;
using LBMethod.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.IntegrationTests.Api;

public class TrainingPortalTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string Routines = "/api/trainer/routines";
    private const string Portal = "/api/portal";
    private static readonly DateOnly Today = BusinessTime.LocalDate(DateTime.UtcNow);

    // PNG mínimo válido (1×1) para comprobar los medios privados.
    private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private async Task<ApiSession> TrainerAsync()
    {
        var email = await api.CreateTrainerAsync();
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
        return session;
    }

    private async Task<(ApiSession Session, int ClientId)> ClientAsync(ApiSession trainer)
    {
        var res = await trainer.PostAsync("/api/trainer/clients", new { firstName = "Ana", lastName = "Cliente", email = $"{TestData.Unique("cli")}@test.local" });
        var created = (await res.Content.ReadFromJsonAsync<TemporaryPasswordResponse>())!;
        string email;
        await using (var db = api.NewDbContext()) email = db.Clients.Single(c => c.Id == created.ClientId).Email;
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, created.TemporaryPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await session.PostAsync("/api/auth/change-password", new { currentPassword = created.TemporaryPassword, newPassword = "MiClaveNueva2026" })).StatusCode);
        await session.RefreshCsrfAsync();
        return (session, created.ClientId);
    }

    private static async Task<int> IdOf(HttpResponseMessage res, HttpStatusCode expected)
    {
        Assert.True(res.StatusCode == expected, $"{res.StatusCode}: {await res.Content.ReadAsStringAsync()}");
        return (await res.Content.ReadFromJsonAsync<IdResponse>())!.Id;
    }

    private static Task<int> ExerciseAsync(ApiSession t, string name) =>
        t.PostAsync("/api/trainer/library/exercises", new
        {
            nameEs = TestData.Unique(name), type = 1, primaryMuscleGroupId = 1, secondaryMuscleGroupIds = Array.Empty<int>(), equipmentIds = Array.Empty<int>(),
            instructions = "Apoya la espalda alta en el banco"
        }).ContinueWith(r => IdOf(r.Result, HttpStatusCode.Created)).Unwrap();

    /// <summary>Rutina de dos días: Día A (hip thrust 3×8–12 a 60 kg, más una serie detallada) y Día B.</summary>
    private static async Task<(int RoutineId, int VersionId, int HipId, int RdlId)> RoutineAsync(ApiSession t, int? dayA = null, int? dayB = null)
    {
        var hip = await ExerciseAsync(t, "Hip thrust");
        var rdl = await ExerciseAsync(t, "Peso muerto rumano");
        var routineId = await IdOf(await t.PostAsync(Routines, new { kind = 1, title = "Glúteo 6 semanas", durationWeeks = 6 }), HttpStatusCode.Created);
        var draftId = await IdOf(await t.PostAsync($"{Routines}/{routineId}/draft"), HttpStatusCode.OK);
        var save = await t.PutAsync($"{Routines}/{routineId}/draft", new
        {
            draftVersionId = draftId, title = "Glúteo 6 semanas", durationWeeks = 6,
            days = new object[]
            {
                new { name = "Día A", dayOfWeek = dayA, exercises = new object[]
                {
                    new { exerciseId = hip, sets = 3, repsMin = 8, repsMax = 12, suggestedWeight = 60m, suggestedWeightUnit = 1, restSeconds = 90, tempo = "3-1-1-0", rir = 2m, setType = 1, notes = "Pausa arriba" },
                    new { exerciseId = rdl, sets = 2, setType = 1, setDetails = new object[]
                    {
                        new { setType = 2, repsMin = 12, repsMax = 12, suggestedWeight = 20m, suggestedWeightUnit = 1 },
                        new { setType = 1, repsMin = 8, repsMax = 10, suggestedWeight = 50m, suggestedWeightUnit = 1, rir = 1m }
                    } }
                } },
                new { name = "Día B", dayOfWeek = dayB, exercises = new object[] { new { exerciseId = rdl, sets = 4, repsMin = 6, repsMax = 8, setType = 1 } } }
            }
        });
        Assert.Equal(HttpStatusCode.NoContent, save.StatusCode);
        var versionId = await IdOf(await t.PostAsync($"{Routines}/{routineId}/publish", new { draftVersionId = draftId }), HttpStatusCode.OK);
        return (routineId, versionId, hip, rdl);
    }

    private static async Task<int> AssignAsync(ApiSession t, int clientId, int versionId, DateOnly? start = null)
    {
        var res = await t.PostAsync("/api/trainer/assignments", new { clientIds = new[] { clientId }, routineVersionId = versionId, startDate = start ?? Today });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<AssignmentCreatedResponse>())!.Ids[0];
    }

    private static object SetsPayload(LoggedExerciseResponse e, Func<LoggedSetResponse, object> map) => new { id = e.Id, isCompleted = true, comment = (string?)null, sets = e.Sets.Select(map).ToArray() };

    [Fact]
    public async Task Client_sees_the_assigned_routine_in_order_with_all_parameters_and_authorized_media()
    {
        using var t = await TrainerAsync();
        var (client, clientId) = await ClientAsync(t);
        var (_, versionId, hip, _) = await RoutineAsync(t);
        var upload = await t.UploadAsync($"/api/trainer/library/exercises/{hip}/media", Png, "hip.png");
        Assert.True(upload.IsSuccessStatusCode, await upload.Content.ReadAsStringAsync());
        var assignmentId = await AssignAsync(t, clientId, versionId);

        var program = Assert.Single((await client.Http.GetFromJsonAsync<List<PortalProgramResponse>>($"{Portal}/program"))!);
        Assert.Equal((assignmentId, "Glúteo 6 semanas", 1, "Vigente"), (program.AssignmentId, program.RoutineName, program.VersionNumber, program.StatusLabel));
        Assert.Equal(["Día A", "Día B"], program.Days.Select(d => d.Name));
        var first = program.Days[0].Exercises[0];
        Assert.Equal((3, 8, 12, 60m, "kg", 90, "3-1-1-0", 2m, "Pausa arriba"),
            (first.Sets, first.RepsMin, first.RepsMax, first.SuggestedWeight, first.WeightUnit, first.RestSeconds, first.Tempo, first.Rir, first.Notes));
        Assert.Equal("Apoya la espalda alta en el banco", first.Instructions);
        Assert.Equal(["Calentamiento", "Efectiva"], program.Days[0].Exercises[1].SetDetails.Select(s => s.SetTypeLabel));

        // La imagen del ejercicio asignado se entrega; la de un ejercicio no asignado no existe para el cliente.
        var image = Assert.Single(first.Media);
        var content = await client.GetAsync(image.Url);
        Assert.Equal(HttpStatusCode.OK, content.StatusCode);
        Assert.Equal("image/png", content.Content.Headers.ContentType!.MediaType);
        var other = await ExerciseAsync(t, "Sin asignar");
        var otherUpload = await t.UploadAsync($"/api/trainer/library/exercises/{other}/media", Png, "otra.png");
        await using var db = api.NewDbContext();
        var otherMediaId = await db.ExerciseMedia.Where(m => m.ExerciseId == other).Select(m => m.Id).SingleAsync();
        Assert.True(otherUpload.IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{Portal}/media/{otherMediaId}/content")).StatusCode);
    }

    [Fact]
    public async Task A_session_is_logged_set_by_set_saved_incomplete_resumed_after_logout_and_finished()
    {
        using var t = await TrainerAsync();
        var (client, clientId) = await ClientAsync(t);
        var (routineId, versionId, _, _) = await RoutineAsync(t);
        var assignmentId = await AssignAsync(t, clientId, versionId);
        var dayA = (await client.Http.GetFromJsonAsync<List<PortalProgramResponse>>($"{Portal}/program"))![0].Days[0].Id;
        var routineBefore = await t.Http.GetStringAsync($"{Routines}/{routineId}/versions/{versionId}");

        var sessionId = await IdOf(await client.PostAsync($"{Portal}/sessions", new { assignmentId, routineDayId = dayA }), HttpStatusCode.OK);
        var s = (await client.Http.GetFromJsonAsync<SessionDetailResponse>($"{Portal}/sessions/{sessionId}"))!;
        Assert.Equal(("InProgress", "Día A", "Glúteo 6 semanas", 1), (s.Status, s.DayName, s.RoutineTitle, s.VersionNumber));
        Assert.Equal([3, 2], s.Exercises.Select(e => e.Sets.Count));
        var detailed = s.Exercises[1].Sets;
        Assert.Equal((true, "Calentamiento", 12, 20m, "kg"), (detailed[0].IsPrescribed, detailed[0].SetTypeLabel, detailed[0].PrescribedRepsMin, detailed[0].PrescribedWeight, detailed[0].PrescribedWeightUnit));

        // Registrar parte del primer ejercicio y una serie extra; guardar dos veces no duplica nada.
        var hip = s.Exercises[0];
        object Progress(bool extra) => new
        {
            comment = "Me sentí bien",
            exercises = new[]
            {
                new { id = hip.Id, isCompleted = false, comment = "Subir peso la próxima", sets = hip.Sets.Select(x => (object)new { setNumber = x.SetNumber, reps = 10, weight = 62.5m, weightUnit = 1, rir = 2m, rpe = (decimal?)null, isCompleted = x.SetNumber <= 2, notes = (string?)null })
                    .Concat(extra ? [new { setNumber = 4, reps = 8, weight = 62.5m, weightUnit = 1, rir = (decimal?)null, rpe = 9m, isCompleted = true, notes = "Serie extra" }] : []).ToArray() }
            }
        };
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"{Portal}/sessions/{sessionId}", Progress(true))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"{Portal}/sessions/{sessionId}", Progress(true))).StatusCode);

        // Cerrar sesión, volver a entrar y retomar: todo sigue ahí, en la misma sesión.
        Assert.Equal(HttpStatusCode.NoContent, (await client.LogoutAsync()).StatusCode);
        string email;
        await using (var db = api.NewDbContext()) email = db.Clients.Single(c => c.Id == clientId).Email;
        using var again = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await again.LoginAsync(email, "MiClaveNueva2026")).StatusCode);
        var current = (await again.Http.GetFromJsonAsync<SessionDetailResponse>($"{Portal}/sessions/current"))!;
        Assert.Equal(sessionId, current.Id);
        Assert.Equal("Me sentí bien", current.Comment);
        var logged = current.Exercises[0];
        Assert.Equal("Subir peso la próxima", logged.Comment);
        Assert.Equal([1, 2, 3, 4], logged.Sets.Select(x => x.SetNumber));
        Assert.Equal([true, true, false, true], logged.Sets.Select(x => x.IsCompleted));
        Assert.Equal((62.5m, 1, 10), (logged.Sets[0].Weight, logged.Sets[0].WeightUnit, logged.Sets[0].Reps));
        Assert.Equal((false, (int?)null), (logged.Sets[3].IsPrescribed, logged.Sets[3].PrescribedRepsMin));
        Assert.Equal((true, 8, 60m), (logged.Sets[0].IsPrescribed, logged.Sets[0].PrescribedRepsMin, logged.Sets[0].PrescribedWeight));

        // Iniciar el mismo día retoma la misma sesión; otro día pide terminar primero.
        Assert.Equal(sessionId, await IdOf(await again.PostAsync($"{Portal}/sessions", new { assignmentId, routineDayId = dayA }), HttpStatusCode.OK));
        var dayB = (await again.Http.GetFromJsonAsync<List<PortalProgramResponse>>($"{Portal}/program"))![0].Days[1].Id;
        Assert.Equal(HttpStatusCode.Conflict, (await again.PostAsync($"{Portal}/sessions", new { assignmentId, routineDayId = dayB })).StatusCode);

        // Quitar la serie extra está permitido; quitar una prescrita no.
        var removePrescribed = await again.PutAsync($"{Portal}/sessions/{sessionId}", new { exercises = new[] { new { id = hip.Id, isCompleted = true, sets = new[] { new { setNumber = 1, isCompleted = true } } } } });
        Assert.Equal(HttpStatusCode.BadRequest, removePrescribed.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await again.PutAsync($"{Portal}/sessions/{sessionId}", Progress(false))).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await again.PostAsync($"{Portal}/sessions/{sessionId}/finish")).StatusCode);
        var done = (await again.Http.GetFromJsonAsync<SessionDetailResponse>($"{Portal}/sessions/{sessionId}"))!;
        Assert.Equal("Completed", done.Status);
        Assert.NotNull(done.CompletedAt);
        Assert.Equal(3, done.Exercises[0].Sets.Count);
        Assert.Equal(HttpStatusCode.NoContent, (await again.GetAsync($"{Portal}/sessions/current")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await again.PutAsync($"{Portal}/sessions/{sessionId}", Progress(false))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await again.PostAsync($"{Portal}/sessions/{sessionId}/finish")).StatusCode);

        // La rutina maestra no cambió.
        Assert.Equal(routineBefore, await t.Http.GetStringAsync($"{Routines}/{routineId}/versions/{versionId}"));
        var list = (await again.Http.GetFromJsonAsync<List<SessionSummaryResponse>>($"{Portal}/sessions"))!;
        var summary = Assert.Single(list);
        Assert.Equal((0, 2, 2), (summary.ExercisesCompleted, summary.ExercisesTotal, summary.SetsCompleted));
    }

    [Fact]
    public async Task The_history_keeps_what_was_prescribed_even_if_the_routine_changes_later()
    {
        using var t = await TrainerAsync();
        var (client, clientId) = await ClientAsync(t);
        var (routineId, v1, hip, _) = await RoutineAsync(t);
        var assignmentId = await AssignAsync(t, clientId, v1);
        var dayA = (await client.Http.GetFromJsonAsync<List<PortalProgramResponse>>($"{Portal}/program"))![0].Days[0].Id;
        var sessionId = await IdOf(await client.PostAsync($"{Portal}/sessions", new { assignmentId, routineDayId = dayA }), HttpStatusCode.OK);
        await client.PostAsync($"{Portal}/sessions/{sessionId}/finish");

        // La entrenadora publica la versión 2 con otros parámetros y renombra el ejercicio en la biblioteca.
        var draftId = await IdOf(await t.PostAsync($"{Routines}/{routineId}/draft"), HttpStatusCode.OK);
        await t.PutAsync($"{Routines}/{routineId}/draft", new
        {
            draftVersionId = draftId, title = "Glúteo 6 semanas", days = new[] { new { name = "Día A nuevo", exercises = new[] { new { exerciseId = hip, sets = 5, repsMin = 5, repsMax = 5, setType = 1 } } } }
        });
        await IdOf(await t.PostAsync($"{Routines}/{routineId}/publish", new { draftVersionId = draftId }), HttpStatusCode.OK);
        var detail = await t.Http.GetFromJsonAsync<JsonElement>($"/api/trainer/library/exercises/{hip}");
        await t.PutAsync($"/api/trainer/library/exercises/{hip}", new
        {
            nameEs = TestData.Unique("Hip thrust renombrado"), type = 1, primaryMuscleGroupId = 1, secondaryMuscleGroupIds = Array.Empty<int>(), equipmentIds = Array.Empty<int>()
        });
        Assert.NotEqual(JsonValueKind.Undefined, detail.ValueKind);

        var s = (await client.Http.GetFromJsonAsync<SessionDetailResponse>($"{Portal}/sessions/{sessionId}"))!;
        Assert.Equal("Día A", s.DayName);
        Assert.StartsWith("Hip thrust-", s.Exercises[0].NameEs);
        Assert.Equal((3, 8, 12, 60m), (s.Exercises[0].PrescribedSets, s.Exercises[0].PrescribedRepsMin, s.Exercises[0].PrescribedRepsMax, s.Exercises[0].PrescribedWeight));
    }

    [Fact]
    public async Task Home_shows_next_workout_week_and_last_workout_from_real_data()
    {
        using var t = await TrainerAsync();
        var (client, clientId) = await ClientAsync(t);
        var todayDow = (int)Today.DayOfWeek;
        var (_, versionId, _, _) = await RoutineAsync(t, dayA: todayDow, dayB: (todayDow + 2) % 7);
        var assignmentId = await AssignAsync(t, clientId, versionId);

        var home = (await client.Http.GetFromJsonAsync<PortalHomeResponse>($"{Portal}/home"))!;
        Assert.Null(home.Last);
        Assert.Null(home.InProgress);
        Assert.Equal("Día A", Assert.Single(home.Next).DayName);
        Assert.Equal(7, home.Week.Count);
        Assert.Equal(["Día A"], home.Week.Single(d => d.Date == Today).Planned);

        var dayA = home.Next[0].RoutineDayId;
        var sessionId = await IdOf(await client.PostAsync($"{Portal}/sessions", new { assignmentId, routineDayId = dayA }), HttpStatusCode.OK);
        home = (await client.Http.GetFromJsonAsync<PortalHomeResponse>($"{Portal}/home"))!;
        Assert.Equal(sessionId, home.InProgress!.Id);

        await client.PostAsync($"{Portal}/sessions/{sessionId}/finish");
        home = (await client.Http.GetFromJsonAsync<PortalHomeResponse>($"{Portal}/home"))!;
        Assert.Equal(sessionId, home.Last!.Id);
        Assert.Equal("Día B", home.Next[0].DayName);
        Assert.Single(home.Week.Single(d => d.Date == Today).Sessions);
    }

    [Fact]
    public async Task Sessions_follow_the_assignment_rules_and_stay_private()
    {
        using var t = await TrainerAsync();
        var (clientA, idA) = await ClientAsync(t);
        var (clientB, idB) = await ClientAsync(t);
        var (_, versionId, _, _) = await RoutineAsync(t);
        var future = await AssignAsync(t, idA, versionId, Today.AddDays(3));
        var assignmentA = await AssignAsync(t, idA, versionId);
        var assignmentB = await AssignAsync(t, idB, versionId);
        var programs = (await clientA.Http.GetFromJsonAsync<List<PortalProgramResponse>>($"{Portal}/program"))!;
        Assert.Equal(["Active", "Scheduled"], programs.Select(p => p.Status));
        var dayA = programs[0].Days[0].Id;

        // Una rutina que aún no empieza no se entrena; la asignación de otro cliente no existe.
        Assert.Equal(HttpStatusCode.Conflict, (await clientA.PostAsync($"{Portal}/sessions", new { assignmentId = future, routineDayId = dayA })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await clientA.PostAsync($"{Portal}/sessions", new { assignmentId = assignmentB, routineDayId = dayA })).StatusCode);

        var sessionA = await IdOf(await clientA.PostAsync($"{Portal}/sessions", new { assignmentId = assignmentA, routineDayId = dayA }), HttpStatusCode.OK);
        Assert.Equal(HttpStatusCode.NotFound, (await clientB.GetAsync($"{Portal}/sessions/{sessionA}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await clientB.PutAsync($"{Portal}/sessions/{sessionA}", new { exercises = Array.Empty<object>() })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await clientB.PostAsync($"{Portal}/sessions/{sessionA}/finish")).StatusCode);
        Assert.Empty((await clientB.Http.GetFromJsonAsync<List<SessionSummaryResponse>>($"{Portal}/sessions"))!);

        // Valores fuera de rango: errores por campo exacto.
        var s = (await clientA.Http.GetFromJsonAsync<SessionDetailResponse>($"{Portal}/sessions/{sessionA}"))!;
        var e = s.Exercises[0];
        var bad = await clientA.PutAsync($"{Portal}/sessions/{sessionA}", new
        {
            exercises = new[] { new { id = e.Id, isCompleted = false, sets = e.Sets.Select(x => new { setNumber = x.SetNumber, reps = (int?)(x.SetNumber == 1 ? -1 : null), weight = (decimal?)(x.SetNumber == 2 ? 50m : null), weightUnit = (int?)null, rir = (decimal?)(x.SetNumber == 3 ? 2.3m : null), isCompleted = false }).ToArray() } }
        });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var keys = (await bad.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors").EnumerateObject().Select(p => p.Name).Order().ToArray();
        Assert.Equal(["exercises[0].sets[0].reps", "exercises[0].sets[1].weightUnit", "exercises[0].sets[2].rir"], keys);

        // La entrenadora no usa el portal; el cliente no cambia rutinas.
        Assert.Equal(HttpStatusCode.Forbidden, (await t.GetAsync($"{Portal}/program")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clientA.PutAsync($"{Routines}/1/draft", new { })).StatusCode);
    }
}
