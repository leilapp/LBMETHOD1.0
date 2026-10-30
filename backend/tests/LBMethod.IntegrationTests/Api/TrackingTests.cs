using System.Net;
using System.Net.Http.Json;
using LBMethod.Api.Contracts;
using LBMethod.Application.Tracking;
using LBMethod.Domain.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.IntegrationTests.Api;

/// <summary>Factoría con un límite de foto pequeño, para probar el rechazo por tamaño sin subir megas.</summary>
public class TrackingApiFactory : ApiFactory
{
    public const int MaxPhotoBytes = 200 * 1024;
    public TrackingApiFactory() : base(new Dictionary<string, string> { ["Tracking:MaxPhotoBytes"] = MaxPhotoBytes.ToString() }) { }
}

public class TrackingTests(TrackingApiFactory api) : IClassFixture<TrackingApiFactory>
{
    private const string Trainer = "/api/trainer";
    private const string Portal = "/api/portal";
    private static readonly DateOnly Today = BusinessTime.LocalDate(DateTime.UtcNow);
    private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    // Tipos de medida sembrados en la Fase 2.
    private const int BodyWeight = 1, Waist = 2, Hips = 3;

    private async Task<ApiSession> TrainerAsync()
    {
        var email = await api.CreateTrainerAsync();
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
        return session;
    }

    private async Task<(ApiSession Session, int ClientId)> ClientAsync(ApiSession trainer, string name = "Ana")
    {
        var res = await trainer.PostAsync($"{Trainer}/clients", new { firstName = name, lastName = "Cliente", email = $"{TestData.Unique("cli")}@test.local" });
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

    private static async Task<IDictionary<string, string[]>> ErrorsOf(HttpResponseMessage res)
    {
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<ValidationProblemDetails>())!.Errors;
    }

    private static Task<HttpResponseMessage> Evaluate(ApiSession t, int clientId, DateOnly date, string? notes, params object[] measurements) =>
        t.PostAsync($"{Trainer}/clients/{clientId}/evaluations", new { evaluatedOn = date, notes, measurements });

    /// <summary>Rutina publicada de dos días con un ejercicio y asignada desde hoy. Devuelve la asignación y los días.</summary>
    private static async Task<(int AssignmentId, int DayA, int DayB, int ExerciseId)> AssignedRoutineAsync(ApiSession t, int clientId, DayOfWeek? dayA = null, DayOfWeek? dayB = null)
    {
        var ex = await IdOf(await t.PostAsync($"{Trainer}/library/exercises", new
        {
            nameEs = TestData.Unique("Sentadilla"), type = 1, primaryMuscleGroupId = 1, secondaryMuscleGroupIds = Array.Empty<int>(), equipmentIds = Array.Empty<int>()
        }), HttpStatusCode.Created);
        var routineId = await IdOf(await t.PostAsync($"{Trainer}/routines", new { kind = 1, title = "Pierna 4 semanas", durationWeeks = 4 }), HttpStatusCode.Created);
        var draftId = await IdOf(await t.PostAsync($"{Trainer}/routines/{routineId}/draft"), HttpStatusCode.OK);
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Trainer}/routines/{routineId}/draft", new
        {
            draftVersionId = draftId, title = "Pierna 4 semanas", durationWeeks = 4,
            days = new object[]
            {
                new { name = "Día A", dayOfWeek = (int?)dayA, exercises = new object[] { new { exerciseId = ex, sets = 2, repsMin = 8, repsMax = 10, setType = 1 } } },
                new { name = "Día B", dayOfWeek = (int?)dayB, exercises = new object[] { new { exerciseId = ex, sets = 2, repsMin = 8, repsMax = 10, setType = 1 } } },
            }
        })).StatusCode);
        var versionId = await IdOf(await t.PostAsync($"{Trainer}/routines/{routineId}/publish", new { draftVersionId = draftId }), HttpStatusCode.OK);
        var res = await t.PostAsync($"{Trainer}/assignments", new { clientIds = new[] { clientId }, routineVersionId = versionId, startDate = Today });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var assignmentId = (await res.Content.ReadFromJsonAsync<AssignmentCreatedResponse>())!.Ids[0];
        var days = (await t.Http.GetFromJsonAsync<RoutineVersionResponse>($"{Trainer}/routines/{routineId}/versions/{versionId}"))!.Days;
        return (assignmentId, days[0].Id, days[1].Id, ex);
    }

    /// <summary>El cliente registra un entrenamiento con los pesos indicados (unidad 1 = kg, 2 = lb) y lo finaliza si se pide.</summary>
    private static async Task<int> LogSessionAsync(ApiSession client, int assignmentId, int dayId, (decimal Weight, int Unit, int Reps)[] sets, bool finish = true)
    {
        var id = await IdOf(await client.PostAsync($"{Portal}/sessions", new { assignmentId, routineDayId = dayId }), HttpStatusCode.OK);
        var s = (await client.Http.GetFromJsonAsync<SessionDetailResponse>($"{Portal}/sessions/{id}"))!;
        var e = s.Exercises[0];
        var payload = new
        {
            comment = (string?)null,
            exercises = new[]
            {
                new { id = e.Id, isCompleted = true, comment = (string?)null, sets = sets.Select((x, i) => new { setNumber = i + 1, reps = x.Reps, weight = x.Weight, weightUnit = x.Unit, isCompleted = true }).ToArray() }
            }
        };
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"{Portal}/sessions/{id}", payload)).StatusCode);
        if (finish) Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync($"{Portal}/sessions/{id}/finish")).StatusCode);
        return id;
    }

    [Fact]
    public async Task Measurement_types_are_configurable_with_consistent_units()
    {
        using var t = await TrainerAsync();
        var name = TestData.Unique("Cuello");

        var bad = await ErrorsOf(await t.PostAsync($"{Trainer}/measurement-types", new { nameEs = name, kind = 2, unit = "kg" }));
        Assert.Contains("unit", bad.Keys);
        var id = await IdOf(await t.PostAsync($"{Trainer}/measurement-types", new { nameEs = name, kind = 2, unit = "cm" }), HttpStatusCode.Created);
        Assert.Equal(HttpStatusCode.Conflict, (await t.PostAsync($"{Trainer}/measurement-types", new { nameEs = name, kind = 2, unit = "cm" })).StatusCode);

        // Mientras no tenga medidas puede cambiar de unidad; después ya no, para no mezclar unidades en el historial.
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Trainer}/measurement-types/{id}", new { nameEs = name, kind = 2, unit = "in" })).StatusCode);
        var (_, clientId) = await ClientAsync(t);
        await IdOf(await Evaluate(t, clientId, Today, null, new { measurementTypeId = id, value = 14.5m }), HttpStatusCode.Created);
        Assert.Contains("unit", (await ErrorsOf(await t.PutAsync($"{Trainer}/measurement-types/{id}", new { nameEs = name, kind = 2, unit = "cm" }))).Keys);

        // Desactivar lo oculta para registros nuevos, pero conserva el historial.
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Trainer}/measurement-types/{id}", new { nameEs = name, kind = 2, unit = "in", isActive = false })).StatusCode);
        var types = (await t.Http.GetFromJsonAsync<List<MeasurementTypeResponse>>($"{Trainer}/measurement-types"))!;
        var mine = types.Single(x => x.Id == id);
        Assert.Equal((false, 1, "in"), (mine.IsActive, mine.MeasurementCount, mine.Unit));
        Assert.Contains(types, x => x.NameEs == "Peso corporal" && x.Unit == "kg" && x.Kind == 1);
        Assert.Contains("measurements[0].measurementTypeId",
            (await ErrorsOf(await Evaluate(t, clientId, Today, null, new { measurementTypeId = id, value = 15m }))).Keys);
        var history = (await t.Http.GetFromJsonAsync<List<EvaluationResponse>>($"{Trainer}/clients/{clientId}/evaluations"))!;
        Assert.Equal((14.5m, "in"), (history.Single().Measurements.Single().Value, history.Single().Measurements.Single().Unit));
    }

    [Fact]
    public async Task Evaluations_validate_dates_values_and_units_and_corrections_are_audited()
    {
        using var t = await TrainerAsync();
        var (client, clientId) = await ClientAsync(t);

        var errors = await ErrorsOf(await Evaluate(t, clientId, Today.AddDays(1), null,
            new { measurementTypeId = BodyWeight, value = 625m },
            new { measurementTypeId = Waist, value = (decimal?)null },
            new { measurementTypeId = BodyWeight, value = 62.5m },
            new { measurementTypeId = Hips, value = 98.123m }));
        Assert.Contains("evaluatedOn", errors.Keys);
        Assert.Contains("Debe estar entre 1 y 500 kg.", errors["measurements[0].value"]);
        Assert.Contains("measurements[1].value", errors.Keys);
        Assert.Contains("measurements[2].measurementTypeId", errors.Keys);
        Assert.Contains("measurements[3].value", errors.Keys);
        Assert.Contains("measurements", (await ErrorsOf(await Evaluate(t, clientId, Today, null))).Keys);

        var first = await IdOf(await Evaluate(t, clientId, Today.AddDays(-30), "Inicio del programa",
            new { measurementTypeId = BodyWeight, value = 64.2m }, new { measurementTypeId = Waist, value = 74m, notes = "Medida sobre el ombligo" }), HttpStatusCode.Created);
        var second = await IdOf(await Evaluate(t, clientId, Today, null, new { measurementTypeId = BodyWeight, value = 62.8m }), HttpStatusCode.Created);

        // Agregar una medida que faltaba y corregir un valor mal capturado.
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Trainer}/evaluations/{second}",
            new { evaluatedOn = Today, notes = "Revisión mensual", measurements = new[] { new { measurementTypeId = Waist, value = 72.5m } } })).StatusCode);
        Assert.Contains("measurements[0].measurementTypeId", (await ErrorsOf(await t.PutAsync($"{Trainer}/evaluations/{second}",
            new { evaluatedOn = Today, measurements = new[] { new { measurementTypeId = Waist, value = 71m } } }))).Keys);
        var list = (await t.Http.GetFromJsonAsync<List<EvaluationResponse>>($"{Trainer}/clients/{clientId}/evaluations"))!;
        Assert.Equal([second, first], list.Select(e => e.Id));
        var wrong = list[1].Measurements.Single(m => m.MeasurementTypeId == Waist);
        Assert.Equal(("kg", "cm", "Medida sobre el ombligo"), (list[1].Measurements.Single(m => m.MeasurementTypeId == BodyWeight).Unit, wrong.Unit, wrong.Notes));
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Trainer}/measurements/{wrong.Id}", new { value = 75m, notes = wrong.Notes })).StatusCode);
        await using (var db = api.NewDbContext())
        {
            Assert.Equal(75m, db.Measurements.Single(m => m.Id == wrong.Id).Value);
            var audit = await db.AuditLogs.SingleAsync(a => a.Action == "MeasurementCorrected" && a.EntityId == wrong.Id.ToString());
            Assert.Equal("74.00 cm → 75 cm", audit.Details);
        }

        // El cliente ve sus evaluaciones (con fechas) pero no puede registrarlas ni ver las de otros.
        var mine = (await client.Http.GetFromJsonAsync<List<EvaluationResponse>>($"{Portal}/evaluations"))!;
        Assert.Equal([Today, Today.AddDays(-30)], mine.Select(e => e.EvaluatedOn));
        Assert.Equal(HttpStatusCode.Forbidden, (await Evaluate(client, clientId, Today, "x", new { measurementTypeId = BodyWeight, value = 60m })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Trainer}/clients/{clientId}/evaluations")).StatusCode);

        using var other = await TrainerAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Trainer}/clients/{clientId}/evaluations")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Evaluate(other, clientId, Today, "x")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsync($"{Trainer}/measurements/{wrong.Id}", new { value = 70m })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsync($"{Trainer}/evaluations/{first}", new { evaluatedOn = Today })).StatusCode);
    }

    [Fact]
    public async Task Progress_photos_are_private_validated_and_only_for_owner_and_trainer()
    {
        using var t = await TrainerAsync();
        var (client, clientId) = await ClientAsync(t);
        var (otherClient, _) = await ClientAsync(t, "Bea");
        var evaluation = await IdOf(await Evaluate(t, clientId, Today, null, new { measurementTypeId = BodyWeight, value = 60m }), HttpStatusCode.Created);
        var fields = new Dictionary<string, string> { ["takenOn"] = Today.ToString("yyyy-MM-dd"), ["category"] = "1", ["evaluationId"] = evaluation.ToString() };

        Assert.Contains("file", (await ErrorsOf(await t.UploadAsync($"{Trainer}/clients/{clientId}/photos", "no soy una imagen"u8.ToArray(), "foto.jpg", fields))).Keys);
        var big = new byte[TrackingApiFactory.MaxPhotoBytes + 1];
        Png.CopyTo(big, 0);
        Assert.Contains("file", (await ErrorsOf(await t.UploadAsync($"{Trainer}/clients/{clientId}/photos", big, "grande.png", fields))).Keys);
        Assert.Contains("takenOn", (await ErrorsOf(await t.UploadAsync($"{Trainer}/clients/{clientId}/photos", Png, "f.png",
            new Dictionary<string, string> { ["takenOn"] = Today.AddDays(2).ToString("yyyy-MM-dd") }))).Keys);
        var photoId = await IdOf(await t.UploadAsync($"{Trainer}/clients/{clientId}/photos", Png, "frente.png", fields), HttpStatusCode.Created);

        await using (var db = api.NewDbContext())
        {
            var file = db.ProgressPhotos.Include(p => p.StoredFile).Single(p => p.Id == photoId).StoredFile;
            Assert.Equal((clientId, "image/png"), (file.OwnerClientId, file.ContentType));
            Assert.StartsWith("progress/", file.StorageKey);
            Assert.True(File.Exists(Path.Combine(api.StoragePath, file.StorageKey)));
        }

        var photos = (await t.Http.GetFromJsonAsync<List<PhotoResponse>>($"{Trainer}/clients/{clientId}/photos"))!;
        Assert.Equal(("Frente", evaluation, $"/api/trainer/photos/{photoId}/content"), (photos.Single().CategoryLabel, photos.Single().EvaluationId, photos.Single().Url));
        var res = await t.GetAsync($"{Trainer}/photos/{photoId}/content");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Contains("no-store", res.Headers.CacheControl!.ToString());
        Assert.Equal(Png, await res.Content.ReadAsByteArrayAsync());

        // La propia clienta la ve desde su portal; otra clienta, otra entrenadora o sin sesión, no.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"{Portal}/photos/{photoId}/content")).StatusCode);
        Assert.Equal(photoId, (await client.Http.GetFromJsonAsync<List<EvaluationResponse>>($"{Portal}/evaluations"))!.Single().Photos.Single().Id);
        Assert.Equal(HttpStatusCode.NotFound, (await otherClient.GetAsync($"{Portal}/photos/{photoId}/content")).StatusCode);
        Assert.Empty((await otherClient.Http.GetFromJsonAsync<List<PhotoResponse>>($"{Portal}/photos"))!);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Trainer}/photos/{photoId}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.UploadAsync($"{Trainer}/clients/{clientId}/photos", Png, "f.png", fields)).StatusCode);
        using var other = await TrainerAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Trainer}/photos/{photoId}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.UploadAsync($"{Trainer}/clients/{clientId}/photos", Png, "f.png", fields)).StatusCode);
        using var anonymous = api.NewSession();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"{Portal}/photos/{photoId}/content")).StatusCode);
    }

    [Fact]
    public async Task Progress_uses_only_real_data_without_mixing_body_weight_and_loads()
    {
        using var t = await TrainerAsync();
        var (client, clientId) = await ClientAsync(t);
        var (assignmentId, dayA, dayB, exerciseId) = await AssignedRoutineAsync(t, clientId);

        // Dos evaluaciones; la segunda no tiene cintura: no se rellena.
        await IdOf(await Evaluate(t, clientId, Today.AddDays(-14), null, new { measurementTypeId = BodyWeight, value = 64m }, new { measurementTypeId = Waist, value = 75m }), HttpStatusCode.Created);
        await IdOf(await Evaluate(t, clientId, Today, null, new { measurementTypeId = BodyWeight, value = 63.2m }), HttpStatusCode.Created);

        // Dos entrenamientos finalizados (uno en lb) y uno sin terminar, que no cuenta para las cargas.
        await LogSessionAsync(client, assignmentId, dayA, [(60m, 1, 10), (70m, 1, 8)]);
        await LogSessionAsync(client, assignmentId, dayB, [(150m, 2, 8), (160m, 2, 6)]);
        await LogSessionAsync(client, assignmentId, dayA, [(200m, 1, 5), (200m, 1, 5)], finish: false);

        var p = (await t.Http.GetFromJsonAsync<ProgressResult>($"{Trainer}/clients/{clientId}/progress"))!;
        var weight = p.Measurements.Single(s => s.MeasurementTypeId == BodyWeight);
        Assert.Equal(("BodyWeight", "kg"), (weight.Kind, weight.Unit));
        Assert.Equal([64m, 63.2m], weight.Points.Select(x => x.Value));
        Assert.Equal([Today.AddDays(-14), Today], weight.Points.Select(x => x.Date));
        Assert.Single(p.Measurements.Single(s => s.MeasurementTypeId == Waist).Points);

        var loads = p.Exercises.Single(e => e.ExerciseId == exerciseId);
        Assert.Equal(2, loads.Points.Count);
        Assert.True(loads.HasConvertedValues);
        // Empate de unidades (una sesión en kg, otra en lb): se usa kg y el valor en lb se convierte y se marca.
        Assert.Equal("kg", loads.Unit);
        Assert.Equal((70m, 8, false), (loads.Points[0].Weight, loads.Points[0].Reps, loads.Points[0].Converted));
        Assert.Equal((72.57m, 6, true, 160m, "lb"), (loads.Points[1].Weight, loads.Points[1].Reps, loads.Points[1].Converted, loads.Points[1].OriginalWeight, loads.Points[1].OriginalUnit));
        Assert.Equal(60m * 10 + 70m * 8, loads.Points[0].Volume);
        Assert.DoesNotContain(loads.Points, x => x.Weight == 200m);

        Assert.Equal((2, 1, Today), (p.Frequency.Completed, p.Frequency.InProgress, p.Frequency.LastSession));
        Assert.Equal(ProgressService.FrequencyWeeks, p.Frequency.Weeks.Count);
        Assert.Equal(2, p.Frequency.Weeks[^1].Completed);
        Assert.Equal(DayOfWeek.Monday, p.Frequency.Weeks[^1].WeekStart.DayOfWeek);

        // El cliente ve exactamente lo mismo de sí mismo; la entrenadora puede abrir sus entrenamientos.
        var mine = (await client.Http.GetFromJsonAsync<ProgressResult>($"{Portal}/progress"))!;
        Assert.Equal(loads.Points.Select(x => x.Weight), mine.Exercises.Single().Points.Select(x => x.Weight));
        var sessions = (await t.Http.GetFromJsonAsync<List<SessionSummaryResponse>>($"{Trainer}/clients/{clientId}/sessions"))!;
        Assert.Equal(3, sessions.Count);
        var detail = (await t.Http.GetFromJsonAsync<SessionDetailResponse>($"{Trainer}/clients/{clientId}/sessions/{sessions[^1].Id}"))!;
        Assert.Equal((60m, 1), (detail.Exercises[0].Sets[0].Weight, detail.Exercises[0].Sets[0].WeightUnit));

        using var other = await TrainerAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Trainer}/clients/{clientId}/progress")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Trainer}/clients/{clientId}/sessions/{sessions[0].Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Trainer}/clients/{clientId}/progress")).StatusCode);
    }

    [Fact]
    public async Task Calendar_combines_saved_events_programs_sessions_and_evaluations_with_permissions()
    {
        using var t = await TrainerAsync();
        var (client, clientId) = await ClientAsync(t);
        var (otherClient, otherClientId) = await ClientAsync(t, "Bea");
        var tomorrow = Today.AddDays(1);
        var (assignmentId, dayA, _, _) = await AssignedRoutineAsync(t, clientId, Today.DayOfWeek, Today.AddDays(2).DayOfWeek);

        var planned = await IdOf(await t.PostAsync($"{Trainer}/calendar/events", new { clientId, type = 3, date = Today, startTime = "09:00:00", notes = "Trae ropa ajustada" }), HttpStatusCode.Created);
        var training = await IdOf(await t.PostAsync($"{Trainer}/calendar/events", new { clientId, type = 1, title = "Sesión presencial", date = tomorrow, startTime = "18:00:00", endTime = "19:00:00" }), HttpStatusCode.Created);
        var general = await IdOf(await t.PostAsync($"{Trainer}/calendar/events", new { type = 99, title = "Gimnasio cerrado", date = tomorrow }), HttpStatusCode.Created);
        await IdOf(await t.PostAsync($"{Trainer}/calendar/events", new { clientId = otherClientId, type = 1, title = "Sesión de Bea", date = tomorrow }), HttpStatusCode.Created);

        var errors = await ErrorsOf(await t.PostAsync($"{Trainer}/calendar/events", new { type = 3, startTime = "10:00:00", endTime = "09:00:00" }));
        Assert.Contains("date", errors.Keys);
        Assert.Contains("endTime", errors.Keys);
        Assert.Contains("clientId", errors.Keys);
        Assert.Equal(HttpStatusCode.BadRequest, (await t.GetAsync($"{Trainer}/calendar?from={Today:yyyy-MM-dd}&to={Today.AddDays(90):yyyy-MM-dd}")).StatusCode);

        // Un entrenamiento hoy y la evaluación registrada hoy: el evento programado queda como hecho.
        await LogSessionAsync(client, assignmentId, dayA, [(50m, 1, 10), (50m, 1, 10)]);
        var evaluation = await IdOf(await Evaluate(t, clientId, Today, null, new { measurementTypeId = BodyWeight, value = 61m }), HttpStatusCode.Created);
        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Trainer}/calendar/events/{training}/status", new { status = 3 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await t.PutAsync($"{Trainer}/calendar/events/{training}", new { clientId, type = 1, date = tomorrow })).StatusCode);

        var range = $"from={Today:yyyy-MM-dd}&to={Today.AddDays(6):yyyy-MM-dd}";
        var items = (await t.Http.GetFromJsonAsync<List<CalendarItem>>($"{Trainer}/calendar?{range}&clientId={clientId}"))!;
        var today = items.Where(i => i.Date == Today).ToList();
        Assert.Contains(today, i => i.Kind == "program-start");
        Assert.Contains(today, i => i.Kind == "planned" && i.Title == "Día A" && i.Status == "completed");
        Assert.Contains(today, i => i.Kind == "session" && i.Status == "completed");
        var evalItem = Assert.Single(today, i => i.Kind == "evaluation");
        Assert.Equal((planned, evaluation, "completed", new TimeOnly(9, 0)), (evalItem.EventId, evalItem.EvaluationId, evalItem.Status, evalItem.StartTime));
        Assert.Contains(items, i => i.Date == Today.AddDays(2) && i.Kind == "planned" && i.Title == "Día B" && i.Status == "planned");
        Assert.Contains(items, i => i.Date == tomorrow && i.Kind == "rest");
        Assert.Contains(items, i => i.Date == tomorrow && i.Kind == "training" && i.Status == "cancelled");
        Assert.DoesNotContain(items, i => i.EventId == general || i.Title == "Sesión de Bea");

        // Vista general: todos los clientes y eventos generales, sin días de rutina deducidos.
        var all = (await t.Http.GetFromJsonAsync<List<CalendarItem>>($"{Trainer}/calendar?{range}"))!;
        Assert.Contains(all, i => i.EventId == general && i.ClientId == null);
        Assert.Contains(all, i => i.Title == "Sesión de Bea" && i.ClientName == "Bea Cliente");
        Assert.DoesNotContain(all, i => i.Kind is "planned" or "rest");

        // La clienta ve lo suyo, sin cancelados, sin eventos generales ni de otras clientas.
        var mine = (await client.Http.GetFromJsonAsync<List<CalendarItem>>($"{Portal}/calendar?{range}"))!;
        Assert.Contains(mine, i => i.Kind == "evaluation" && i.Notes == "Trae ropa ajustada");
        Assert.Contains(mine, i => i.Kind == "rest");
        Assert.DoesNotContain(mine, i => i.EventId == training || i.EventId == general || i.Title == "Sesión de Bea");
        Assert.All(mine, i => Assert.Null(i.ClientName));
        Assert.DoesNotContain((await otherClient.Http.GetFromJsonAsync<List<CalendarItem>>($"{Portal}/calendar?{range}"))!, i => i.ClientId == clientId);

        // Sin acceso cruzado.
        using var other = await TrainerAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Trainer}/calendar?{range}&clientId={clientId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync($"{Trainer}/calendar/events", new { clientId, type = 1, date = Today })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync($"{Trainer}/calendar/events/{planned}/status", new { status = 3 })).StatusCode);
        Assert.Empty((await other.Http.GetFromJsonAsync<List<CalendarItem>>($"{Trainer}/calendar?{range}"))!);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Trainer}/calendar?{range}")).StatusCode);

        // Inicio de la entrenadora: actividad reciente real.
        var dashboard = (await t.Http.GetFromJsonAsync<TrainerDashboardResponse>($"{Trainer}/dashboard"))!;
        Assert.Contains(dashboard.RecentActivity, a => a.Kind == "session" && a.ClientId == clientId);
        Assert.Contains(dashboard.RecentActivity, a => a.Kind == "evaluation" && a.EvaluationId == evaluation);
    }

    [Fact]
    public async Task Tracking_overview_and_dashboard_show_upcoming_evaluations()
    {
        using var t = await TrainerAsync();
        var (_, clientId) = await ClientAsync(t);
        await IdOf(await Evaluate(t, clientId, Today.AddDays(-7), null, new { measurementTypeId = BodyWeight, value = 61m }), HttpStatusCode.Created);
        var next = await IdOf(await t.PostAsync($"{Trainer}/calendar/events", new { clientId, type = 3, date = Today.AddDays(5) }), HttpStatusCode.Created);
        await IdOf(await t.PostAsync($"{Trainer}/calendar/events", new { clientId, type = 3, date = Today.AddDays(30) }), HttpStatusCode.Created);

        var overview = (await t.Http.GetFromJsonAsync<List<TrackingClientResponse>>($"{Trainer}/tracking"))!;
        var row = overview.Single(c => c.ClientId == clientId);
        Assert.Equal((Today.AddDays(-7), Today.AddDays(5), 0), (row.LastEvaluation, row.NextEvaluation, row.SessionsLast30Days));

        var dashboard = (await t.Http.GetFromJsonAsync<TrainerDashboardResponse>($"{Trainer}/dashboard"))!;
        var upcoming = Assert.Single(dashboard.UpcomingEvaluations);
        Assert.Equal((next, "Ana Cliente", "Evaluación"), (upcoming.EventId, upcoming.ClientName, upcoming.Title));

        using var other = await TrainerAsync();
        Assert.DoesNotContain((await other.Http.GetFromJsonAsync<List<TrackingClientResponse>>($"{Trainer}/tracking"))!, c => c.ClientId == clientId);
        Assert.Empty((await other.Http.GetFromJsonAsync<TrainerDashboardResponse>($"{Trainer}/dashboard"))!.UpcomingEvaluations);
    }
}
