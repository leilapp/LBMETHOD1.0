using System.Net;
using System.Net.Http.Json;
using LBMethod.Api.Contracts;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.IntegrationTests.Api;

public class RoutineTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string Base = "/api/trainer/routines";
    private const string Library = "/api/trainer/library";

    private async Task<ApiSession> TrainerAsync()
    {
        var email = await api.CreateTrainerAsync();
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
        return session;
    }

    private static async Task<int> Id(HttpResponseMessage res, HttpStatusCode expected = HttpStatusCode.Created)
    {
        Assert.True(res.StatusCode == expected, $"{res.StatusCode}: {await res.Content.ReadAsStringAsync()}");
        return (await res.Content.ReadFromJsonAsync<IdResponse>())!.Id;
    }

    private static async Task<int> ExerciseAsync(ApiSession t, string name) =>
        await Id(await t.PostAsync($"{Library}/exercises", new
        {
            nameEs = TestData.Unique(name), type = 1, primaryMuscleGroupId = 1, secondaryMuscleGroupIds = Array.Empty<int>(), equipmentIds = Array.Empty<int>()
        }));

    private static object Ex(int exerciseId, int sets = 3, int? repsMin = 8, int? repsMax = 12, string? superset = null,
        int setType = 1, object[]? details = null, decimal? weight = null, int? unit = null, int? rest = 90, decimal? rir = null, decimal? rpe = null) => new
    {
        exerciseId, supersetGroup = superset, sets, repsMin, repsMax, suggestedWeight = weight, suggestedWeightUnit = unit,
        restSeconds = rest, tempo = "3-1-1-0", rir, rpe, setType, notes = "Controlar la bajada", setDetails = details ?? []
    };

    private static object Draft(int draftId, string title, params object[] days) =>
        new { draftVersionId = draftId, title, description = "Bloque de fuerza", goal = "Hipertrofia de glúteo", durationWeeks = 6, days };

    private static object Day(string name, int? dayOfWeek, params object[] exercises) => new { name, dayOfWeek, notes = (string?)null, exercises };

    private static async Task<(int RoutineId, int DraftId)> NewRoutineAsync(ApiSession t, string title = "Programa", int kind = 1)
    {
        var id = await Id(await t.PostAsync(Base, new { kind, title, goal = "Hipertrofia", durationWeeks = 6 }));
        var detail = (await t.Http.GetFromJsonAsync<RoutineDetailResponse>($"{Base}/{id}"))!;
        return (id, detail.DraftVersionId!.Value);
    }

    private static Task<RoutineVersionResponse?> VersionAsync(ApiSession t, int routineId, int versionId) =>
        t.Http.GetFromJsonAsync<RoutineVersionResponse>($"{Base}/{routineId}/versions/{versionId}");

    [Fact]
    public async Task Trainer_builds_a_routine_by_days_saves_reloads_and_recovers_it_from_sql_server()
    {
        using var t = await TrainerAsync();
        var hip = await ExerciseAsync(t, "Hip thrust");
        var rdl = await ExerciseAsync(t, "Peso muerto rumano");
        var abd = await ExerciseAsync(t, "Abducción");
        var (routineId, draftId) = await NewRoutineAsync(t, "Glúteo 6 semanas");
        var masterBefore = await t.Http.GetStringAsync($"{Library}/exercises/{hip}");

        var save = await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Glúteo 6 semanas",
            Day("Día 1 - Glúteo", 1,
                Ex(hip, 4, 8, 12, weight: 60m, unit: 1, rir: 2m),
                Ex(rdl, 3, 10, 10, superset: "a", rpe: 7.5m),
                Ex(abd, 3, 15, 20, superset: "A", rest: 60)),
            Day("Día 2 - Pierna", 3,
                Ex(hip, 3, details: [
                    new { setType = 2, repsMin = 12, repsMax = 12, suggestedWeight = 20m, suggestedWeightUnit = 1, restSeconds = 60 },
                    new { setType = 1, repsMin = 8, repsMax = 10, suggestedWeight = 70m, suggestedWeightUnit = 1, restSeconds = 120, rir = 1m },
                    new { setType = 3, repsMin = (int?)null, repsMax = (int?)null, restSeconds = 0, notes = "Bajar 20% y al fallo técnico" }
                ]))));
        Assert.Equal(HttpStatusCode.NoContent, save.StatusCode);

        // Recargar con un contexto nuevo: todo viene de la base de datos.
        var v = (await VersionAsync(t, routineId, draftId))!;
        Assert.Equal("Draft", v.Status);
        Assert.Equal(6, v.DurationWeeks);
        Assert.Equal(["Día 1 - Glúteo", "Día 2 - Pierna"], v.Days.Select(d => d.Name));
        Assert.Equal("Lunes", v.Days[0].DayLabel);
        var day1 = v.Days[0].Exercises;
        Assert.Equal([hip, rdl, abd], day1.Select(e => e.ExerciseId));
        Assert.Equal([1, 2, 3], day1.Select(e => e.Position));
        Assert.Equal(60m, day1[0].SuggestedWeight);
        Assert.Equal(2m, day1[0].Rir);
        Assert.Equal(7.5m, day1[1].Rpe);
        Assert.Equal("A", day1[1].SupersetGroup); // se normaliza a mayúscula
        Assert.Equal("A", day1[2].SupersetGroup);
        var detailed = v.Days[1].Exercises.Single();
        Assert.Equal(3, detailed.Sets); // el número de series sale del detalle
        Assert.Equal(["Calentamiento", "Efectiva", "Dropset"], detailed.SetDetails.Select(s => s.SetTypeLabel));

        // Los parámetros de la rutina no modifican el ejercicio maestro.
        Assert.Equal(masterBefore, await t.Http.GetStringAsync($"{Library}/exercises/{hip}"));
        await using (var db = api.NewDbContext())
            Assert.Equal(2, await db.RoutineExercises.CountAsync(x => x.ExerciseId == hip && x.RoutineDay.RoutineVersionId == draftId));

        // Reordenar: se guarda el nuevo orden.
        save = await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Glúteo 6 semanas",
            Day("Día 2 - Pierna", 3, Ex(abd), Ex(hip)),
            Day("Día 1 - Glúteo", 1, Ex(rdl), Ex(hip))));
        Assert.Equal(HttpStatusCode.NoContent, save.StatusCode);
        v = (await VersionAsync(t, routineId, draftId))!;
        Assert.Equal(["Día 2 - Pierna", "Día 1 - Glúteo"], v.Days.Select(d => d.Name));
        Assert.Equal([abd, hip], v.Days[0].Exercises.Select(e => e.ExerciseId));
        Assert.Equal([rdl, hip], v.Days[1].Exercises.Select(e => e.ExerciseId));
    }

    [Fact]
    public async Task Invalid_parameters_are_rejected_with_the_exact_field()
    {
        using var t = await TrainerAsync();
        var hip = await ExerciseAsync(t, "Hip thrust");
        var (routineId, draftId) = await NewRoutineAsync(t);

        async Task<string> Rejected(object exercise)
        {
            var res = await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Programa", Day("Día 1", null, exercise)));
            var body = await res.Content.ReadAsStringAsync();
            Assert.True(res.StatusCode == HttpStatusCode.BadRequest, body);
            return body;
        }

        Assert.Contains("days[0].exercises[0].repsMax", await Rejected(Ex(hip, repsMin: 12, repsMax: 8)));
        Assert.Contains("days[0].exercises[0].sets", await Rejected(Ex(hip, sets: 0)));
        Assert.Contains("days[0].exercises[0].suggestedWeightUnit", await Rejected(Ex(hip, weight: 50m)));
        Assert.Contains("days[0].exercises[0].rir", await Rejected(Ex(hip, rir: 11m)));
        Assert.Contains("days[0].exercises[0].rpe", await Rejected(Ex(hip, rpe: 7.3m)));
        Assert.Contains("days[0].exercises[0].exerciseId", await Rejected(Ex(999999)));
        Assert.Contains("days[0].exercises[0].supersetGroup", await Rejected(Ex(hip, superset: "Super serie")));

        // Los opcionales pueden ir vacíos.
        var ok = await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Programa",
            Day("Día 1", null, Ex(hip, 3, repsMin: null, repsMax: null, rest: null))));
        Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);

        var noTitle = await t.PutAsync($"{Base}/{routineId}/draft", new { draftVersionId = draftId, title = "", days = new[] { new { name = "" } } });
        Assert.Equal(HttpStatusCode.BadRequest, noTitle.StatusCode);
        var body = await noTitle.Content.ReadAsStringAsync();
        Assert.Contains("\"title\"", body);
        Assert.Contains("days[0].name", body);
    }

    [Fact]
    public async Task Publishing_freezes_the_version_and_editing_creates_a_new_traceable_version()
    {
        using var t = await TrainerAsync();
        var hip = await ExerciseAsync(t, "Hip thrust");
        var squat = await ExerciseAsync(t, "Sentadilla");
        var (routineId, draftId) = await NewRoutineAsync(t);

        // No se publica vacío ni con superseries incompletas.
        var empty = await t.PostAsync($"{Base}/{routineId}/publish", new { draftVersionId = draftId });
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Programa", Day("Día 1", 1, Ex(hip, superset: "A"))));
        var lonely = await t.PostAsync($"{Base}/{routineId}/publish", new { draftVersionId = draftId });
        Assert.Contains("superserie A", await lonely.Content.ReadAsStringAsync());

        await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Programa", Day("Día 1", 1, Ex(hip, 4))));
        var v1 = await Id(await t.PostAsync($"{Base}/{routineId}/publish", new { draftVersionId = draftId, changeNotes = "Primera versión" }), HttpStatusCode.OK);
        Assert.Equal(draftId, v1);

        // Una versión publicada ya no se puede guardar como borrador.
        var overwrite = await t.PutAsync($"{Base}/{routineId}/draft", Draft(v1, "Cambiado", Day("Día 1", 1, Ex(squat))));
        Assert.Equal(HttpStatusCode.Conflict, overwrite.StatusCode);

        // Editar = abrir un borrador nuevo (v2) copiado de v1.
        var v2 = await Id(await t.PostAsync($"{Base}/{routineId}/draft"), HttpStatusCode.OK);
        Assert.NotEqual(v1, v2);
        Assert.Equal(v2, await Id(await t.PostAsync($"{Base}/{routineId}/draft"), HttpStatusCode.OK)); // un solo borrador
        var draft2 = (await VersionAsync(t, routineId, v2))!;
        Assert.Equal(2, draft2.VersionNumber);
        Assert.Equal(v1, draft2.SourceVersionId);
        Assert.Equal(hip, draft2.Days.Single().Exercises.Single().ExerciseId);

        await t.PutAsync($"{Base}/{routineId}/draft", Draft(v2, "Programa", Day("Día 1", 1, Ex(squat, 5, 5, 5))));
        await Id(await t.PostAsync($"{Base}/{routineId}/publish", new { draftVersionId = v2, changeNotes = "Cambio a sentadilla" }), HttpStatusCode.OK);

        // La versión 1 sigue intacta.
        var first = (await VersionAsync(t, routineId, v1))!;
        Assert.Equal("Published", first.Status);
        Assert.Equal(hip, first.Days.Single().Exercises.Single().ExerciseId);
        Assert.Equal(4, first.Days.Single().Exercises.Single().Sets);

        var detail = (await t.Http.GetFromJsonAsync<RoutineDetailResponse>($"{Base}/{routineId}"))!;
        Assert.Equal([2, 1], detail.Versions.Select(x => x.VersionNumber));
        Assert.All(detail.Versions, x => Assert.Equal("Published", x.Status));
        Assert.Null(detail.DraftVersionId);
        Assert.Equal(v2, detail.LatestPublishedVersionId);
        Assert.Equal("Cambio a sentadilla", detail.Versions[0].ChangeNotes);

        await using var db = api.NewDbContext();
        Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == "RoutinePublished" && a.EntityId == routineId.ToString() && a.Details == "v2"));
    }

    [Fact]
    public async Task A_deactivated_exercise_cannot_be_published_but_old_versions_keep_it()
    {
        using var t = await TrainerAsync();
        var hip = await ExerciseAsync(t, "Hip thrust");
        var (routineId, draftId) = await NewRoutineAsync(t);
        await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Programa", Day("Día 1", 1, Ex(hip))));
        await Id(await t.PostAsync($"{Base}/{routineId}/publish", new { draftVersionId = draftId }), HttpStatusCode.OK);

        await t.PostAsync($"{Library}/exercises/{hip}/status", new { active = false });
        var published = (await VersionAsync(t, routineId, draftId))!;
        Assert.False(published.Days.Single().Exercises.Single().ExerciseIsActive);

        var v2 = await Id(await t.PostAsync($"{Base}/{routineId}/draft"), HttpStatusCode.OK);
        var res = await t.PostAsync($"{Base}/{routineId}/publish", new { draftVersionId = v2 });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("desactivado", await res.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Discarding_a_draft_keeps_published_versions()
    {
        using var t = await TrainerAsync();
        var hip = await ExerciseAsync(t, "Hip thrust");
        var (routineId, draftId) = await NewRoutineAsync(t);

        // Sin versiones publicadas no se descarta (se archiva).
        Assert.Equal(HttpStatusCode.Conflict, (await t.DeleteAsync($"{Base}/{routineId}/draft")).StatusCode);

        await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Programa", Day("Día 1", 1, Ex(hip))));
        await t.PostAsync($"{Base}/{routineId}/publish", new { draftVersionId = draftId });
        var v2 = await Id(await t.PostAsync($"{Base}/{routineId}/draft"), HttpStatusCode.OK);
        Assert.Equal(HttpStatusCode.NoContent, (await t.DeleteAsync($"{Base}/{routineId}/draft")).StatusCode);

        var detail = (await t.Http.GetFromJsonAsync<RoutineDetailResponse>($"{Base}/{routineId}"))!;
        Assert.Null(detail.DraftVersionId);
        Assert.Equal(draftId, Assert.Single(detail.Versions).Id);
        Assert.Equal(HttpStatusCode.NotFound, (await t.GetAsync($"{Base}/{routineId}/versions/{v2}")).StatusCode);
    }

    [Fact]
    public async Task Duplicate_save_as_template_and_create_from_template_copy_without_touching_the_original()
    {
        using var t = await TrainerAsync();
        var hip = await ExerciseAsync(t, "Hip thrust");
        var (routineId, draftId) = await NewRoutineAsync(t, "Original");
        await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Original",
            Day("Día 1", 1, Ex(hip, 4, superset: "A"), Ex(hip, 2, superset: "A", setType: 3))));
        await t.PostAsync($"{Base}/{routineId}/publish", new { draftVersionId = draftId });

        var copyId = await Id(await t.PostAsync($"{Base}/{routineId}/copy", new { kind = 1, title = "Original (copia)" }));
        var templateId = await Id(await t.PostAsync($"{Base}/{routineId}/copy", new { kind = 2, title = "Plantilla glúteo" }));
        var fromTemplateId = await Id(await t.PostAsync($"{Base}/{templateId}/copy", new { kind = 1, title = "Programa de Ana" }));

        foreach (var (id, kind, title) in new[] { (copyId, "Program", "Original (copia)"), (templateId, "Template", "Plantilla glúteo"), (fromTemplateId, "Program", "Programa de Ana") })
        {
            var d = (await t.Http.GetFromJsonAsync<RoutineDetailResponse>($"{Base}/{id}"))!;
            Assert.Equal(kind, d.Kind);
            var v = (await VersionAsync(t, id, d.DraftVersionId!.Value))!;
            Assert.Equal(title, v.Title);
            Assert.Equal("Draft", v.Status);
            Assert.Equal(["A", "A"], v.Days.Single().Exercises.Select(e => e.SupersetGroup));
            Assert.Equal("Dropset", v.Days.Single().Exercises[1].SetTypeLabel);
            Assert.NotNull(v.SourceVersionId);
        }

        // Editar la copia no cambia el original.
        var copy = (await t.Http.GetFromJsonAsync<RoutineDetailResponse>($"{Base}/{copyId}"))!;
        await t.PutAsync($"{Base}/{copyId}/draft", Draft(copy.DraftVersionId!.Value, "Original (copia)", Day("Otro", 2, Ex(hip, 1))));
        var original = (await VersionAsync(t, routineId, draftId))!;
        Assert.Equal(2, original.Days.Single().Exercises.Count);

        var programs = (await t.Http.GetFromJsonAsync<List<RoutineSummaryResponse>>(Base))!;
        var templates = (await t.Http.GetFromJsonAsync<List<RoutineSummaryResponse>>($"{Base}?kind=template"))!;
        Assert.Equal(new[] { fromTemplateId, copyId, routineId }.Order(), programs.Select(p => p.Id).Order());
        Assert.Equal(templateId, Assert.Single(templates).Id);
        var orig = programs.Single(p => p.Id == routineId);
        Assert.Equal(1, orig.PublishedVersionNumber);
        Assert.False(orig.HasDraft);
        Assert.Equal(2, orig.ExerciseCount);
    }

    [Fact]
    public async Task Archiving_hides_the_routine_keeps_versions_and_can_be_restored()
    {
        using var t = await TrainerAsync();
        var (routineId, draftId) = await NewRoutineAsync(t, "Para archivar");
        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Base}/{routineId}/archive")).StatusCode);

        Assert.DoesNotContain((await t.Http.GetFromJsonAsync<List<RoutineSummaryResponse>>(Base))!, r => r.Id == routineId);
        Assert.Contains((await t.Http.GetFromJsonAsync<List<RoutineSummaryResponse>>($"{Base}?status=archived"))!, r => r.Id == routineId);
        Assert.Equal(HttpStatusCode.Conflict, (await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Cambio"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await t.GetAsync($"{Base}/{routineId}/versions/{draftId}")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Base}/{routineId}/restore")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Cambio"))).StatusCode);
    }

    [Fact]
    public async Task Routines_are_private_to_their_trainer_and_clients_cannot_use_the_builder()
    {
        using var owner = await TrainerAsync();
        var (routineId, draftId) = await NewRoutineAsync(owner, "Privada");

        using var other = await TrainerAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Base}/{routineId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Base}/{routineId}/versions/{draftId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsync($"{Base}/{routineId}/draft", Draft(draftId, "Robada"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync($"{Base}/{routineId}/copy", new { kind = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync($"{Base}/{routineId}/archive")).StatusCode);
        Assert.DoesNotContain((await other.Http.GetFromJsonAsync<List<RoutineSummaryResponse>>(Base))!, r => r.Id == routineId);

        var created = await owner.PostAsync("/api/trainer/clients", new { firstName = "Ana", lastName = "Cliente", email = $"{TestData.Unique("cli")}@test.local" });
        var temp = (await created.Content.ReadFromJsonAsync<TemporaryPasswordResponse>())!;
        string email;
        await using (var db = api.NewDbContext()) email = db.Clients.Single(c => c.Id == temp.ClientId).Email;
        using var client = api.NewSession();
        await client.LoginAsync(email, temp.TemporaryPassword);
        await client.PostAsync("/api/auth/change-password", new { currentPassword = temp.TemporaryPassword, newPassword = "MiClaveNueva2026" });
        await client.RefreshCsrfAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(Base)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Base}/{routineId}/versions/{draftId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync(Base, new { kind = 1, title = "x" })).StatusCode);
    }
}
