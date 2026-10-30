using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LBMethod.Api.Contracts;
using LBMethod.Domain.Common;
using LBMethod.Domain.Routines;
using LBMethod.Domain.Training;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.IntegrationTests.Api;

public class ClientAssignmentTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string Clients = "/api/trainer/clients";
    private const string Assignments = "/api/trainer/assignments";
    private const string Routines = "/api/trainer/routines";
    private static readonly DateOnly Today = BusinessTime.LocalDate(DateTime.UtcNow);

    private async Task<ApiSession> TrainerAsync()
    {
        var email = await api.CreateTrainerAsync();
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
        return session;
    }

    private static async Task<TemporaryPasswordResponse> NewClientAsync(ApiSession trainer, string firstName = "Ana")
    {
        var res = await trainer.PostAsync(Clients, new { firstName, lastName = "Cliente", email = $"{TestData.Unique("cli")}@test.local" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<TemporaryPasswordResponse>())!;
    }

    private async Task<string> EmailOfAsync(int clientId)
    {
        await using var db = api.NewDbContext();
        return db.Clients.Single(c => c.Id == clientId).Email;
    }

    /// <summary>Sesión del cliente con la contraseña temporal ya cambiada.</summary>
    private async Task<ApiSession> ClientSessionAsync(TemporaryPasswordResponse created, string? email = null)
    {
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email ?? await EmailOfAsync(created.ClientId), created.TemporaryPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await session.PostAsync("/api/auth/change-password", new { currentPassword = created.TemporaryPassword, newPassword = "MiClaveNueva2026" })).StatusCode);
        await session.RefreshCsrfAsync();
        return session;
    }

    private static async Task<int> IdOf(HttpResponseMessage res, HttpStatusCode expected)
    {
        Assert.True(res.StatusCode == expected, $"{res.StatusCode}: {await res.Content.ReadAsStringAsync()}");
        return (await res.Content.ReadFromJsonAsync<IdResponse>())!.Id;
    }

    /// <summary>Crea una rutina con un día y un ejercicio y la publica. Devuelve la rutina y su versión publicada.</summary>
    private static async Task<(int RoutineId, int VersionId)> PublishedRoutineAsync(ApiSession t, string title = "Glúteo 6 semanas", int kind = 1)
    {
        var exercise = await IdOf(await t.PostAsync("/api/trainer/library/exercises", new
        {
            nameEs = TestData.Unique("Hip thrust"), type = 1, primaryMuscleGroupId = 1, secondaryMuscleGroupIds = Array.Empty<int>(), equipmentIds = Array.Empty<int>()
        }), HttpStatusCode.Created);
        var routineId = await IdOf(await t.PostAsync(Routines, new { kind, title, durationWeeks = 6 }), HttpStatusCode.Created);
        var version = await PublishNextAsync(t, routineId, title, exercise);
        return (routineId, version);
    }

    private static async Task<int> PublishNextAsync(ApiSession t, int routineId, string title, int? exerciseId = null)
    {
        var draftId = await IdOf(await t.PostAsync($"{Routines}/{routineId}/draft"), HttpStatusCode.OK);
        if (exerciseId is { } ex)
        {
            var save = await t.PutAsync($"{Routines}/{routineId}/draft", new
            {
                draftVersionId = draftId, title,
                days = new[] { new { name = "Día 1", exercises = new[] { new { exerciseId = ex, sets = 4, repsMin = 8, repsMax = 12, setType = 1 } } } }
            });
            Assert.Equal(HttpStatusCode.NoContent, save.StatusCode);
        }
        return await IdOf(await t.PostAsync($"{Routines}/{routineId}/publish", new { draftVersionId = draftId, changeNotes = "ok" }), HttpStatusCode.OK);
    }

    private static Task<HttpResponseMessage> AssignAsync(ApiSession t, int[] clientIds, int versionId, DateOnly start, DateOnly? end = null, string? notes = null) =>
        t.PostAsync(Assignments, new { clientIds, routineVersionId = versionId, startDate = start, endDate = end, notes });

    private static Task<List<AssignmentResponse>?> AssignmentsOf(ApiSession t, int clientId) =>
        t.Http.GetFromJsonAsync<List<AssignmentResponse>>($"{Clients}/{clientId}/assignments");

    private static async Task<string[]> ErrorKeys(HttpResponseMessage res)
    {
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("errors").EnumerateObject().Select(p => p.Name).Order().ToArray();
    }

    private static object Profile(string email, object? overrides = null) => new
    {
        firstName = "Mariana", lastName = "López", email, phone = "+52 473 123 4567", birthDate = new DateOnly(1994, 5, 12),
        height = 165.5m, heightUnit = 1, weight = 62.3m, weightUnit = 1, experienceLevel = 2, goal = "Ganar fuerza en glúteo",
        trainingLocation = 1, availableDays = (int)(WeekDays.Monday | WeekDays.Wednesday | WeekDays.Friday), sessionDurationMinutes = 60,
        declaredLimitations = "Molestia en rodilla izquierda"
    };

    [Fact]
    public async Task Trainer_edits_the_full_profile_and_it_is_recovered_from_sql_server()
    {
        using var t = await TrainerAsync();
        var created = await NewClientAsync(t);
        var email = await EmailOfAsync(created.ClientId);

        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Clients}/{created.ClientId}/profile", Profile(email))).StatusCode);

        var p = (await t.Http.GetFromJsonAsync<ClientDetailResponse>($"{Clients}/{created.ClientId}/profile"))!;
        Assert.Equal(("Mariana", "López", "+52 473 123 4567"), (p.FirstName, p.LastName, p.Phone));
        Assert.Equal(new DateOnly(1994, 5, 12), p.BirthDate);
        Assert.Equal((165.5m, 1, 62.3m, 1), (p.Height, p.HeightUnit, p.Weight, p.WeightUnit));
        Assert.Equal(("Intermedio", "Gimnasio", 60), (p.ExperienceLabel, p.TrainingLocationLabel, p.SessionDurationMinutes));
        Assert.Equal(["Lunes", "Miércoles", "Viernes"], p.AvailableDayNames);
        Assert.Equal("Molestia en rodilla izquierda", p.DeclaredLimitations);
        Assert.Equal("Active", p.Status);
        Assert.True(p.RegisteredAt > DateTime.UtcNow.AddMinutes(-5));

        // Datos inválidos: errores con el nombre exacto de cada campo y nada se guarda.
        var bad = await t.PutAsync($"{Clients}/{created.ClientId}/profile", new
        {
            firstName = "", lastName = "López", email = "no-es-correo", birthDate = Today.AddDays(1), height = 400m, heightUnit = 1,
            weight = 70m, sessionDurationMinutes = 5, availableDays = 0
        });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal(["birthDate", "email", "firstName", "height", "sessionDurationMinutes", "weightUnit"], await ErrorKeys(bad));
        Assert.Equal("Mariana", (await t.Http.GetFromJsonAsync<ClientDetailResponse>($"{Clients}/{created.ClientId}/profile"))!.FirstName);
    }

    [Fact]
    public async Task Changing_the_email_changes_the_login_and_it_must_stay_unique()
    {
        using var t = await TrainerAsync();
        var created = await NewClientAsync(t);
        var other = await NewClientAsync(t, "Otra");
        var otherEmail = await EmailOfAsync(other.ClientId);
        var oldEmail = await EmailOfAsync(created.ClientId);

        var duplicate = await t.PutAsync($"{Clients}/{created.ClientId}/profile", Profile(otherEmail.ToUpperInvariant()));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var newEmail = $"{TestData.Unique("nuevo")}@test.local";
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Clients}/{created.ClientId}/profile", Profile(newEmail))).StatusCode);

        using var withOld = api.NewSession();
        Assert.NotEqual(HttpStatusCode.OK, (await withOld.LoginAsync(oldEmail, created.TemporaryPassword)).StatusCode);
        using var client = await ClientSessionAsync(created, newEmail);
        Assert.Equal(newEmail, (await client.Http.GetFromJsonAsync<ClientProfileResponse>("/api/portal/profile"))!.Email);
    }

    [Fact]
    public async Task Private_notes_are_for_the_trainer_only()
    {
        using var t = await TrainerAsync();
        var created = await NewClientAsync(t);
        const string secret = "Observación privada: revisar técnica de bisagra";

        await IdOf(await t.PostAsync($"{Clients}/{created.ClientId}/notes", new { content = secret }), HttpStatusCode.Created);
        Assert.Equal(HttpStatusCode.BadRequest, (await t.PostAsync($"{Clients}/{created.ClientId}/notes", new { content = "  " })).StatusCode);
        var notes = (await t.Http.GetFromJsonAsync<List<ClientNoteResponse>>($"{Clients}/{created.ClientId}/notes"))!;
        Assert.Equal(secret, Assert.Single(notes).Content);

        using var client = await ClientSessionAsync(created);
        Assert.DoesNotContain("revisar técnica", await client.Http.GetStringAsync("/api/portal/profile"));
        Assert.DoesNotContain("revisar técnica", await client.Http.GetStringAsync("/api/portal/assignments"));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Clients}/{created.ClientId}/notes")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Clients}/{created.ClientId}/profile")).StatusCode);
    }

    [Fact]
    public async Task One_routine_version_is_assigned_to_several_clients_without_copying_its_exercises()
    {
        using var t = await TrainerAsync();
        var ana = await NewClientAsync(t, "Ana");
        var bea = await NewClientAsync(t, "Bea");
        var (routineId, v1) = await PublishedRoutineAsync(t);
        int DaysInDb() { using var db = api.NewDbContext(); return db.RoutineDays.Count(d => d.RoutineVersion.RoutineId == routineId); }
        var daysBefore = DaysInDb();

        var res = await AssignAsync(t, [ana.ClientId, bea.ClientId], v1, Today, Today.AddDays(41), "Calienta 10 minutos antes");
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        Assert.Equal(2, (await res.Content.ReadFromJsonAsync<AssignmentCreatedResponse>())!.Ids.Count);
        Assert.Equal(daysBefore, DaysInDb());

        foreach (var c in new[] { ana, bea })
        {
            var a = Assert.Single((await AssignmentsOf(t, c.ClientId))!);
            Assert.Equal((v1, 1, "Active", "Vigente"), (a.RoutineVersionId, a.VersionNumber, a.Status, a.StatusLabel));
            Assert.Equal((Today, Today.AddDays(41)), (a.StartDate, a.EndDate));
        }
        var byRoutine = (await t.Http.GetFromJsonAsync<List<AssignmentResponse>>($"{Routines}/{routineId}/assignments"))!;
        Assert.Equal([ana.ClientId, bea.ClientId], byRoutine.Select(a => a.ClientId).Order());
        var list = (await t.Http.GetFromJsonAsync<List<ClientSummaryResponse>>(Clients))!;
        Assert.All(list, c => Assert.Equal("Glúteo 6 semanas", c.CurrentProgram));

        // Cada cliente ve solo su propia asignación, con la indicación para el cliente.
        using var anaSession = await ClientSessionAsync(ana);
        var mine = Assert.Single((await anaSession.Http.GetFromJsonAsync<List<PortalAssignmentResponse>>("/api/portal/assignments"))!);
        Assert.Equal(("Glúteo 6 semanas", 1, "Vigente", "Calienta 10 minutos antes"), (mine.RoutineName, mine.VersionNumber, mine.StatusLabel, mine.Notes));
    }

    [Fact]
    public async Task Only_published_programs_of_the_trainer_can_be_assigned_to_active_clients()
    {
        using var t = await TrainerAsync();
        var client = await NewClientAsync(t);
        var (routineId, v1) = await PublishedRoutineAsync(t);

        var draftOnly = await IdOf(await t.PostAsync(Routines, new { kind = 1, title = "Solo borrador" }), HttpStatusCode.Created);
        var draftVersion = (await t.Http.GetFromJsonAsync<RoutineDetailResponse>($"{Routines}/{draftOnly}"))!.DraftVersionId!.Value;
        var notPublished = await AssignAsync(t, [client.ClientId], draftVersion, Today);
        Assert.Equal(["routineVersionId"], await ErrorKeys(notPublished));

        var (_, templateVersion) = await PublishedRoutineAsync(t, "Plantilla base", kind: 2);
        Assert.Equal(["routineVersionId"], await ErrorKeys(await AssignAsync(t, [client.ClientId], templateVersion, Today)));

        Assert.Equal(["endDate"], await ErrorKeys(await AssignAsync(t, [client.ClientId], v1, Today, Today.AddDays(-1))));
        Assert.Equal(["clientIds"], await ErrorKeys(await AssignAsync(t, [], v1, Today)));

        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Routines}/{routineId}/archive")).StatusCode);
        Assert.Equal(["routineVersionId"], await ErrorKeys(await AssignAsync(t, [client.ClientId], v1, Today)));
        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Routines}/{routineId}/restore")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Clients}/{client.ClientId}/access", new { enabled = false })).StatusCode);
        Assert.Equal(["clientIds"], await ErrorKeys(await AssignAsync(t, [client.ClientId], v1, Today)));
        Assert.Empty((await AssignmentsOf(t, client.ClientId))!);
    }

    [Fact]
    public async Task Changing_program_keeps_the_history_and_each_assignment_keeps_its_version()
    {
        using var t = await TrainerAsync();
        var client = await NewClientAsync(t);
        var (routineId, v1) = await PublishedRoutineAsync(t);
        var first = (await (await AssignAsync(t, [client.ClientId], v1, Today.AddDays(-14))).Content.ReadFromJsonAsync<AssignmentCreatedResponse>())!.Ids[0];

        // Se publica la versión 2: la asignación sigue en la versión 1 y avisa que hay una más nueva.
        var v2 = await PublishNextAsync(t, routineId, "Glúteo 6 semanas");
        var current = Assert.Single((await AssignmentsOf(t, client.ClientId))!);
        Assert.Equal((v1, 1, 2, v2), (current.RoutineVersionId, current.VersionNumber, current.LatestVersionNumber, current.LatestVersionId));

        // Terminar la actual y asignar la nueva: las dos quedan en el historial.
        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Assignments}/{first}/end-date", new { endDate = Today.AddDays(-1) })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await AssignAsync(t, [client.ClientId], v2, Today)).StatusCode);

        var history = (await AssignmentsOf(t, client.ClientId))!;
        Assert.Equal([(v2, "Active"), (v1, "Completed")], history.Select(a => (a.RoutineVersionId, a.Status)));
        Assert.Equal(Today.AddDays(-1), history[1].EndDate);
        Assert.Equal(HttpStatusCode.Conflict, (await t.PostAsync($"{Assignments}/{first}/cancel")).StatusCode);
        Assert.Equal(["endDate"], await ErrorKeys(await t.PostAsync($"{Assignments}/{history[0].Id}/end-date", new { endDate = Today.AddDays(-30) })));
    }

    [Fact]
    public async Task A_future_assignment_can_be_cancelled_and_stays_as_history_for_the_trainer()
    {
        using var t = await TrainerAsync();
        var created = await NewClientAsync(t);
        var (_, v1) = await PublishedRoutineAsync(t);
        var res = await AssignAsync(t, [created.ClientId], v1, Today.AddDays(7));
        var id = (await res.Content.ReadFromJsonAsync<AssignmentCreatedResponse>())!.Ids[0];
        Assert.Equal("Scheduled", Assert.Single((await AssignmentsOf(t, created.ClientId))!).Status);

        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Assignments}/{id}/cancel")).StatusCode);
        var a = Assert.Single((await AssignmentsOf(t, created.ClientId))!);
        Assert.Equal(("Cancelled", "Cancelada"), (a.Status, a.StatusLabel));
        Assert.Equal(HttpStatusCode.Conflict, (await t.PostAsync($"{Assignments}/{id}/end-date", new { endDate = Today.AddDays(10) })).StatusCode);

        // Al cliente no se le muestra una asignación cancelada.
        using var client = await ClientSessionAsync(created);
        Assert.Empty((await client.Http.GetFromJsonAsync<List<PortalAssignmentResponse>>("/api/portal/assignments"))!);
    }

    [Fact]
    public async Task Deactivating_a_client_keeps_assignments_notes_and_training_history()
    {
        using var t = await TrainerAsync();
        var created = await NewClientAsync(t);
        var (_, v1) = await PublishedRoutineAsync(t);
        await AssignAsync(t, [created.ClientId], v1, Today.AddDays(-3));
        await t.PostAsync($"{Clients}/{created.ClientId}/notes", new { content = "Nota" });
        await using (var db = api.NewDbContext())
        {
            var assignment = db.RoutineAssignments.Single(a => a.ClientId == created.ClientId);
            db.TrainingLogs.Add(new TrainingLog { ClientId = created.ClientId, RoutineAssignmentId = assignment.Id, StartedAt = DateTime.UtcNow.AddDays(-1) });
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Clients}/{created.ClientId}/access", new { enabled = false })).StatusCode);

        Assert.Equal("Inactive", (await t.Http.GetFromJsonAsync<ClientDetailResponse>($"{Clients}/{created.ClientId}/profile"))!.Status);
        Assert.Single((await AssignmentsOf(t, created.ClientId))!);
        Assert.Single((await t.Http.GetFromJsonAsync<List<ClientNoteResponse>>($"{Clients}/{created.ClientId}/notes"))!);
        await using (var db = api.NewDbContext())
            Assert.Equal(1, await db.TrainingLogs.CountAsync(l => l.ClientId == created.ClientId));
    }

    [Fact]
    public async Task Another_trainer_cannot_see_or_change_profiles_notes_or_assignments()
    {
        using var t1 = await TrainerAsync();
        using var t2 = await TrainerAsync();
        var created = await NewClientAsync(t1);
        var (routineId, v1) = await PublishedRoutineAsync(t1);
        var id = (await (await AssignAsync(t1, [created.ClientId], v1, Today.AddDays(5))).Content.ReadFromJsonAsync<AssignmentCreatedResponse>())!.Ids[0];
        var email = await EmailOfAsync(created.ClientId);

        Assert.Equal(HttpStatusCode.NotFound, (await t2.GetAsync($"{Clients}/{created.ClientId}/profile")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await t2.PutAsync($"{Clients}/{created.ClientId}/profile", Profile(email))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await t2.GetAsync($"{Clients}/{created.ClientId}/notes")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await t2.PostAsync($"{Clients}/{created.ClientId}/notes", new { content = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await t2.GetAsync($"{Clients}/{created.ClientId}/assignments")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await t2.PostAsync($"{Assignments}/{id}/cancel")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await t2.PostAsync($"{Assignments}/{id}/end-date", new { endDate = Today.AddDays(9) })).StatusCode);
        Assert.Empty((await t2.Http.GetFromJsonAsync<List<AssignmentResponse>>($"{Routines}/{routineId}/assignments"))!);

        // Ni asignar su rutina a un cliente ajeno, ni una rutina ajena a un cliente propio.
        var (_, otherVersion) = await PublishedRoutineAsync(t2);
        var own = await NewClientAsync(t2);
        Assert.Equal(HttpStatusCode.NotFound, (await AssignAsync(t2, [created.ClientId], otherVersion, Today)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await AssignAsync(t2, [own.ClientId], v1, Today)).StatusCode);

        // Un cliente no puede usar las funciones de la entrenadora.
        using var client = await ClientSessionAsync(created);
        Assert.Equal(HttpStatusCode.Forbidden, (await AssignAsync(client, [created.ClientId], v1, Today)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Clients}/{created.ClientId}/assignments")).StatusCode);
    }
}
