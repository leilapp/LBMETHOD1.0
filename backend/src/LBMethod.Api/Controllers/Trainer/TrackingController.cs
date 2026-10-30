using LBMethod.Api.Contracts;
using LBMethod.Api.Controllers.Trainer.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Clients;
using LBMethod.Application.Library;
using LBMethod.Application.Security;
using LBMethod.Application.Tracking;
using LBMethod.Domain.Calendar;
using LBMethod.Domain.Clients;
using LBMethod.Domain.Common;
using LBMethod.Domain.Tracking;
using LBMethod.Domain.Training;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Trainer;

/// <summary>
/// Seguimiento de la entrenadora: tipos de medida, evaluaciones, fotos privadas, progreso y entrenamientos registrados
/// de sus clientes. Un cliente ajeno se trata como inexistente (404).
/// </summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer")]
public class TrackingController(TrackingService tracking, ProgressService progress, AssignmentService assignments, ClientAccess access, IAppDbContext db, ICurrentUser user) : ControllerBase
{
    private static string PhotoUrl(int id) => $"/api/trainer/photos/{id}/content";
    private static string MediaUrl(int id) => $"/api/trainer/library/media/{id}/content";

    [HttpGet("tracking/options")]
    public TrackingOptionsResponse Options() => new(
        TrackingLabels.Kinds.Select(k => new KindOptionResponse((int)k.Key, k.Value, TrackingLabels.UnitsByKind[k.Key])).ToList(),
        TrackingLabels.PhotoCategories.Select(c => new OptionResponse((int)c.Key, c.Value)).ToList(),
        TrackingLabels.ManualEventTypes.Select(t => new OptionResponse((int)t.Key, t.Value)).ToList());

    // ---------- Tipos de medida ----------

    [HttpGet("measurement-types")]
    public async Task<IReadOnlyList<MeasurementTypeResponse>> Types(CancellationToken ct)
    {
        var counts = await db.Measurements.GroupBy(m => m.MeasurementTypeId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        return (await db.MeasurementTypes.AsNoTracking().OrderBy(t => t.SortOrder).ThenBy(t => t.Id).ToListAsync(ct))
            .Select(t => new MeasurementTypeResponse(t.Id, t.NameEs, t.NameEn, (int)t.Kind, TrackingLabels.Kinds[t.Kind], t.Unit, t.SortOrder, t.IsActive, counts.GetValueOrDefault(t.Id)))
            .ToList();
    }

    [HttpPost("measurement-types")]
    public async Task<IActionResult> CreateType(MeasurementTypeRequest r, CancellationToken ct)
    {
        var result = await tracking.CreateTypeAsync(TypeInput(r), ct);
        return this.ToResponse(result, () => StatusCode(StatusCodes.Status201Created, new IdResponse(result.Id)));
    }

    [HttpPut("measurement-types/{id:int}")]
    public async Task<IActionResult> UpdateType(int id, MeasurementTypeRequest r, CancellationToken ct) =>
        this.ToResponse(await tracking.UpdateTypeAsync(id, TypeInput(r), ct), NoContent);

    private static MeasurementTypeInput TypeInput(MeasurementTypeRequest r) =>
        new(r.NameEs ?? string.Empty, r.NameEn, (MeasurementKind)(r.Kind ?? 0), r.Unit ?? string.Empty, r.IsActive ?? true);

    // ---------- Resumen de seguimiento ----------

    [HttpGet("tracking")]
    public async Task<IReadOnlyList<TrackingClientResponse>> Overview(CancellationToken ct)
    {
        var today = assignments.Today();
        var since = DateTime.UtcNow.AddDays(-30);
        var clients = await access.VisibleClients().AsNoTracking().OrderBy(c => c.FirstName).ThenBy(c => c.LastName)
            .Select(c => new
            {
                c.Id, Name = c.FirstName + " " + c.LastName, c.Status,
                LastEvaluation = db.Evaluations.Where(e => e.ClientId == c.Id).Max(e => (DateOnly?)e.EvaluatedOn),
                NextEvaluation = db.CalendarEvents.Where(e => e.ClientId == c.Id && e.Type == CalendarEventType.Evaluation && e.Status == CalendarEventStatus.Planned && e.Date >= today)
                    .Min(e => (DateOnly?)e.Date),
                LastSession = db.TrainingLogs.Where(l => l.ClientId == c.Id).Max(l => (DateTime?)l.StartedAt),
                Recent = db.TrainingLogs.Count(l => l.ClientId == c.Id && l.Status == TrainingLogStatus.Completed && l.StartedAt >= since),
                Open = db.TrainingLogs.Count(l => l.ClientId == c.Id && l.Status == TrainingLogStatus.InProgress),
            }).ToListAsync(ct);
        var current = (await assignments.Owned().AsNoTracking().Select(a => new { a.ClientId, a.Status, a.StartDate, a.EndDate, a.RoutineVersion.Title }).ToListAsync(ct))
            .Where(a => AssignmentState.Effective(a.Status, a.StartDate, a.EndDate, today) == Domain.Routines.AssignmentStatus.Active)
            .GroupBy(a => a.ClientId).ToDictionary(g => g.Key, g => string.Join(", ", g.Select(a => a.Title)));
        return clients.Select(c => new TrackingClientResponse(c.Id, c.Name, c.Status.ToString(), current.GetValueOrDefault(c.Id),
            c.LastEvaluation, c.NextEvaluation, c.LastSession, c.Recent, c.Open)).ToList();
    }

    /// <summary>Próximas evaluaciones (14 días) y actividad reciente de los clientes, para el inicio de la entrenadora.</summary>
    [HttpGet("dashboard")]
    public async Task<TrainerDashboardResponse> Dashboard(CancellationToken ct)
    {
        var today = assignments.Today();
        var userId = user.UserId;
        var upcoming = await db.CalendarEvents.AsNoTracking()
            .Where(e => e.TrainerId == userId && e.ClientId != null && e.Type == CalendarEventType.Evaluation && e.Status == CalendarEventStatus.Planned
                && e.Date >= today && e.Date <= today.AddDays(14))
            .OrderBy(e => e.Date).ThenBy(e => e.StartTime).Take(10)
            .Select(e => new UpcomingEvaluationResponse(e.Id, e.ClientId!.Value, e.Client!.FirstName + " " + e.Client.LastName, e.Date, e.StartTime, e.Title))
            .ToListAsync(ct);
        var clients = access.VisibleClients();
        var sessions = await db.TrainingLogs.AsNoTracking().Where(l => clients.Any(c => c.Id == l.ClientId) && l.Status == TrainingLogStatus.Completed)
            .OrderByDescending(l => l.CompletedAt).Take(8)
            .Select(l => new ActivityResponse("session", l.ClientId, l.Client.FirstName + " " + l.Client.LastName, l.CompletedAt!.Value,
                l.DayName ?? "Entrenamiento", l.RoutineTitle, l.Id, null))
            .ToListAsync(ct);
        var evaluations = await db.Evaluations.AsNoTracking().Where(e => clients.Any(c => c.Id == e.ClientId))
            .OrderByDescending(e => e.CreatedAt).Take(8)
            .Select(e => new ActivityResponse("evaluation", e.ClientId, e.Client.FirstName + " " + e.Client.LastName, e.CreatedAt,
                "Evaluación", e.Measurements.Count() + " medidas", null, e.Id))
            .ToListAsync(ct);
        return new TrainerDashboardResponse(upcoming, sessions.Concat(evaluations).OrderByDescending(a => a.OccurredAt).Take(8).ToList());
    }

    // ---------- Evaluaciones y medidas ----------

    [HttpGet("clients/{clientId:int}/evaluations")]
    public async Task<ActionResult<IReadOnlyList<EvaluationResponse>>> Evaluations(int clientId, CancellationToken ct)
    {
        if (!await access.TrainerOwnsClientAsync(clientId, ct)) return NotFound();
        return await TrackingQueries.EvaluationsAsync(db, clientId, PhotoUrl, ct);
    }

    [HttpPost("clients/{clientId:int}/evaluations")]
    public async Task<IActionResult> CreateEvaluation(int clientId, EvaluationRequest r, CancellationToken ct)
    {
        var result = await tracking.CreateEvaluationAsync(clientId, EvaluationInput(r), ct);
        return this.ToResponse(result, () => StatusCode(StatusCodes.Status201Created, new IdResponse(result.Id)));
    }

    [HttpPut("evaluations/{id:int}")]
    public async Task<IActionResult> UpdateEvaluation(int id, EvaluationRequest r, CancellationToken ct) =>
        this.ToResponse(await tracking.UpdateEvaluationAsync(id, EvaluationInput(r), ct), NoContent);

    [HttpPut("measurements/{id:int}")]
    public async Task<IActionResult> CorrectMeasurement(int id, CorrectMeasurementRequest r, CancellationToken ct) =>
        this.ToResponse(await tracking.CorrectMeasurementAsync(id, r.Value, r.Notes, ct), NoContent);

    private static EvaluationInput EvaluationInput(EvaluationRequest r) => new(r.EvaluatedOn, r.Notes,
        (r.Measurements ?? []).Select(m => new MeasurementInput(m.MeasurementTypeId, m.Value, m.Notes)).ToList());

    // ---------- Fotos ----------

    [HttpGet("clients/{clientId:int}/photos")]
    public async Task<ActionResult<IReadOnlyList<PhotoResponse>>> Photos(int clientId, CancellationToken ct)
    {
        if (!await access.TrainerOwnsClientAsync(clientId, ct)) return NotFound();
        return await TrackingQueries.PhotosAsync(db, clientId, PhotoUrl, ct);
    }

    [HttpPost("clients/{clientId:int}/photos")]
    [MediaUploadLimit]
    public async Task<IActionResult> UploadPhoto(int clientId, [FromForm] IFormFile? file, [FromForm] DateOnly? takenOn, [FromForm] int? category,
        [FromForm] int? evaluationId, [FromForm] string? notes, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return this.ToResponse(LibraryResult.Invalid("file", "Selecciona una foto."), NoContent);
        await using var stream = file.OpenReadStream();
        var result = await tracking.UploadPhotoAsync(clientId, stream, file.Length, new PhotoInput(takenOn, (PhotoCategory?)category, evaluationId, notes), ct);
        return this.ToResponse(result, () => StatusCode(StatusCodes.Status201Created, new IdResponse(result.Id)));
    }

    [HttpGet("photos/{id:int}/content")]
    public async Task<IActionResult> PhotoContent(int id, CancellationToken ct) => await PrivateFile.ServeAsync(this, await tracking.OpenPhotoAsync(id, ct));

    // ---------- Progreso y entrenamientos registrados ----------

    [HttpGet("clients/{clientId:int}/progress")]
    public async Task<ActionResult<ProgressResult>> Progress(int clientId, CancellationToken ct) =>
        await progress.BuildAsync(clientId, ct) is { } result ? result : NotFound();

    [HttpGet("clients/{clientId:int}/sessions")]
    public async Task<ActionResult<IReadOnlyList<SessionSummaryResponse>>> Sessions(int clientId, CancellationToken ct)
    {
        if (!await access.TrainerOwnsClientAsync(clientId, ct)) return NotFound();
        return await SessionQueries.Summaries(db.TrainingLogs.Where(l => l.ClientId == clientId).OrderByDescending(l => l.StartedAt)).Take(200).ToListAsync(ct);
    }

    [HttpGet("clients/{clientId:int}/sessions/{id:int}")]
    public async Task<ActionResult<SessionDetailResponse>> Session(int clientId, int id, CancellationToken ct)
    {
        if (!await access.TrainerOwnsClientAsync(clientId, ct)) return NotFound();
        var detail = await SessionQueries.DetailAsync(db.TrainingLogs.Where(l => l.ClientId == clientId), id, db, MediaUrl, ct);
        return detail is null ? NotFound() : detail;
    }
}

/// <summary>Entrega un archivo privado sin caché ni URL pública.</summary>
internal static class PrivateFile
{
    public static Task<IActionResult> ServeAsync(ControllerBase c, PhotoContent? content)
    {
        if (content is null) return Task.FromResult<IActionResult>(c.NotFound());
        c.Response.Headers.CacheControl = "private, no-store";
        c.Response.Headers["X-Content-Type-Options"] = "nosniff";
        c.Response.Headers.ContentDisposition = "inline";
        return Task.FromResult<IActionResult>(c.File(content.Content, content.ContentType));
    }
}
