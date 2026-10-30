using LBMethod.Api.Contracts;
using LBMethod.Api.Controllers.Trainer.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Clients;
using LBMethod.Application.Library;
using LBMethod.Application.Routines;
using LBMethod.Application.Security;
using LBMethod.Application.Training;
using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Routines;
using LBMethod.Domain.Training;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Portal;

/// <summary>
/// Portal del cliente: su rutina (solo lectura), los medios autorizados y el registro de sus entrenamientos.
/// Todo se resuelve con la sesión actual; nunca se aceptan Ids de cliente.
/// </summary>
[ApiController]
[Authorize(Policy = Policies.Client)]
[Route("api/portal")]
public class TrainingController(TrainingService training, ClientAccess access, MediaService media, IAppDbContext db) : ControllerBase
{
    private static string? Unit(WeightUnit? u) => u?.ToString().ToLowerInvariant();

    /// <summary>Asignaciones vigentes o por empezar, con días, ejercicios, parámetros y medios.</summary>
    [HttpGet("program")]
    public async Task<ActionResult<IReadOnlyList<PortalProgramResponse>>> Program(CancellationToken ct)
    {
        var clientId = await access.CurrentClientIdAsync(ct);
        if (clientId is null) return NotFound();
        var today = training.Today();
        var assignments = (await db.RoutineAssignments.AsNoTracking().Where(a => a.ClientId == clientId)
                .Include(a => a.RoutineVersion).ThenInclude(v => v.Days).ThenInclude(d => d.Exercises).ThenInclude(e => e.Exercise)
                .Include(a => a.RoutineVersion).ThenInclude(v => v.Days).ThenInclude(d => d.Exercises).ThenInclude(e => e.SetDetails)
                .ToListAsync(ct))
            .Select(a => (a, Status: AssignmentState.Effective(a.Status, a.StartDate, a.EndDate, today)))
            .Where(x => AssignmentState.IsCurrent(x.Status))
            .OrderBy(x => x.Status == AssignmentStatus.Active ? 0 : 1).ThenBy(x => x.a.StartDate)
            .ToList();

        var exerciseIds = assignments.SelectMany(x => x.a.RoutineVersion.Days).SelectMany(d => d.Exercises).Select(e => e.ExerciseId).Distinct().ToList();
        var mediaByExercise = await MediaForAsync(exerciseIds, ct);

        return assignments.Select(x =>
        {
            var v = x.a.RoutineVersion;
            return new PortalProgramResponse(x.a.Id, v.Title, v.VersionNumber, v.Description, v.Goal, v.DurationWeeks, x.a.StartDate, x.a.EndDate,
                x.Status.ToString(), ClientLabels.Statuses[x.Status], x.a.Notes,
                v.Days.OrderBy(d => d.Position).Select(d => new PortalDayResponse(d.Id, d.Position, d.Name,
                    d.DayOfWeek is { } dow ? RoutineLabels.Days[dow] : null, d.Notes,
                    d.Exercises.OrderBy(e => e.Position).Select(e => new PortalExerciseResponse(e.Id, e.Position, e.ExerciseId,
                        e.Exercise.NameEs, e.Exercise.NameEn, e.SupersetGroup, e.Sets, e.RepsMin, e.RepsMax, e.SuggestedWeight, Unit(e.SuggestedWeightUnit),
                        e.RestSeconds, e.Tempo, e.Rir, e.Rpe, RoutineLabels.SetTypes[e.SetType], e.Notes, e.Exercise.Instructions, e.Exercise.TechnicalTips,
                        e.SetDetails.OrderBy(s => s.SetNumber).Select(s => new PortalSetResponse(s.SetNumber, RoutineLabels.SetTypes[s.SetType],
                            s.RepsMin, s.RepsMax, s.SuggestedWeight, Unit(s.SuggestedWeightUnit), s.RestSeconds, s.Rir, s.Rpe, s.Notes)).ToList(),
                        mediaByExercise.GetValueOrDefault(e.ExerciseId) ?? [])).ToList())).ToList());
        }).ToList();
    }

    /// <summary>
    /// Imagen o video privado, solo si el ejercicio está en alguna rutina asignada al cliente.
    /// Cualquier otro medio se trata como inexistente.
    /// </summary>
    [HttpGet("media/{mediaId:int}/content")]
    public async Task<IActionResult> Media(int mediaId, CancellationToken ct)
    {
        var clientId = await access.CurrentClientIdAsync(ct);
        if (clientId is null) return NotFound();
        var allowed = await db.ExerciseMedia.AnyAsync(m => m.Id == mediaId &&
            db.RoutineAssignments.Any(a => a.ClientId == clientId && a.Status != AssignmentStatus.Cancelled &&
                a.RoutineVersion.Days.Any(d => d.Exercises.Any(e => e.ExerciseId == m.ExerciseId))), ct);
        if (!allowed) return NotFound();
        var content = await media.OpenAsync(mediaId, ct);
        if (content is null) return NotFound();
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers.ContentDisposition = "inline";
        return File(content.Content, content.ContentType, enableRangeProcessing: true);
    }

    /// <summary>Inicio: entrenamiento en curso, próximo entrenamiento, semana actual y último entrenamiento.</summary>
    [HttpGet("home")]
    public async Task<ActionResult<PortalHomeResponse>> Home(CancellationToken ct)
    {
        var clientId = await access.CurrentClientIdAsync(ct);
        if (clientId is null) return NotFound();
        var today = training.Today();
        var monday = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));

        var active = (await db.RoutineAssignments.AsNoTracking().Where(a => a.ClientId == clientId)
                .Include(a => a.RoutineVersion).ThenInclude(v => v.Days).ToListAsync(ct))
            .Where(a => AssignmentState.IsCurrent(AssignmentState.Effective(a.Status, a.StartDate, a.EndDate, today)))
            .OrderBy(a => a.StartDate).ToList();

        var mine = await training.MineAsync(ct);
        var weekStartUtc = TimeZoneInfo.ConvertTimeToUtc(monday.ToDateTime(TimeOnly.MinValue), BusinessTime.TimeZone);
        var recent = await Summaries(mine.Where(l => l.StartedAt >= weekStartUtc || l.Status == TrainingLogStatus.InProgress)).ToListAsync(ct);
        var last = await Summaries(mine.Where(l => l.Status == TrainingLogStatus.Completed).OrderByDescending(l => l.CompletedAt)).FirstOrDefaultAsync(ct);
        var inProgress = recent.FirstOrDefault(s => s.Status == nameof(TrainingLogStatus.InProgress));

        // Próximo entrenamiento por rutina vigente: si los días tienen día de la semana, el siguiente desde hoy
        // que aún no se hizo; si no, el día que sigue al último entrenado (en el orden de la rutina).
        var lastDayByAssignment = await mine.Where(l => l.RoutineAssignmentId != null && l.RoutineDayId != null)
            .GroupBy(l => l.RoutineAssignmentId!.Value)
            .Select(g => new { AssignmentId = g.Key, DayId = g.OrderByDescending(l => l.StartedAt).Select(l => l.RoutineDayId!.Value).First() })
            .ToDictionaryAsync(x => x.AssignmentId, x => x.DayId, ct);
        var doneToday = recent.Where(s => BusinessTime.LocalDate(s.StartedAt) == today).Select(s => s.Id).ToHashSet();
        var doneTodayDays = await mine.Where(l => doneToday.Contains(l.Id)).Select(l => l.RoutineDayId).ToListAsync(ct);

        var next = new List<NextWorkoutResponse>();
        foreach (var a in active.Where(a => a.StartDate <= today))
        {
            var days = a.RoutineVersion.Days.OrderBy(d => d.Position).ToList();
            if (days.Count == 0) continue;
            RoutineDay pick;
            if (days.All(d => d.DayOfWeek is not null))
                pick = Enumerable.Range(0, 7).Select(offset => today.AddDays(offset))
                    .SelectMany(date => days.Where(d => d.DayOfWeek == date.DayOfWeek && !(date == today && doneTodayDays.Contains(d.Id))))
                    .FirstOrDefault() ?? days[0];
            else
            {
                var lastIndex = lastDayByAssignment.TryGetValue(a.Id, out var lastDay) ? days.FindIndex(d => d.Id == lastDay) : -1;
                pick = days[(lastIndex + 1) % days.Count];
            }
            next.Add(new NextWorkoutResponse(a.Id, a.RoutineVersion.Title, pick.Id, pick.Name, pick.DayOfWeek is { } dow ? RoutineLabels.Days[dow] : null));
        }

        var week = Enumerable.Range(0, 7).Select(i => monday.AddDays(i)).Select(date => new WeekDayResponse(date, RoutineLabels.Days[date.DayOfWeek],
            active.Where(a => a.StartDate <= date && (a.EndDate is null || a.EndDate >= date))
                .SelectMany(a => a.RoutineVersion.Days.Where(d => d.DayOfWeek == date.DayOfWeek).OrderBy(d => d.Position).Select(d => d.Name)).ToList(),
            recent.Where(s => BusinessTime.LocalDate(s.StartedAt) == date).OrderBy(s => s.StartedAt).ToList())).ToList();

        return new PortalHomeResponse(inProgress, next, week, last);
    }

    private static IQueryable<SessionSummaryResponse> Summaries(IQueryable<TrainingLog> q) => q.Select(l => new SessionSummaryResponse(
        l.Id, l.RoutineTitle, l.RoutineVersionNumber, l.DayName, l.Status == TrainingLogStatus.InProgress ? "InProgress" : "Completed",
        l.StartedAt, l.CompletedAt, l.Exercises.Count(e => e.IsCompleted), l.Exercises.Count(), l.Exercises.SelectMany(e => e.Sets).Count(s => s.IsCompleted)));

    [HttpGet("sessions")]
    public async Task<IReadOnlyList<SessionSummaryResponse>> Sessions(CancellationToken ct) =>
        await Summaries((await training.MineAsync(ct)).OrderByDescending(l => l.StartedAt)).Take(200).ToListAsync(ct);

    [HttpGet("sessions/current")]
    public async Task<ActionResult<SessionDetailResponse>> Current(CancellationToken ct)
    {
        var id = await (await training.MineAsync(ct)).Where(l => l.Status == TrainingLogStatus.InProgress).Select(l => (int?)l.Id).SingleOrDefaultAsync(ct);
        return id is null ? NoContent() : await Session(id.Value, ct);
    }

    [HttpGet("sessions/{id:int}")]
    public async Task<ActionResult<SessionDetailResponse>> Session(int id, CancellationToken ct)
    {
        var log = await (await training.MineAsync(ct)).AsNoTracking()
            .Include(l => l.Exercises).ThenInclude(e => e.Sets)
            .AsSplitQuery()
            .SingleOrDefaultAsync(l => l.Id == id, ct);
        if (log is null) return NotFound();
        var mediaByExercise = await MediaForAsync(log.Exercises.Select(e => e.ExerciseId).Distinct().ToList(), ct);
        return new SessionDetailResponse(log.Id, log.RoutineAssignmentId, log.RoutineTitle, log.RoutineVersionNumber, log.DayName,
            log.Status == TrainingLogStatus.InProgress ? "InProgress" : "Completed", log.StartedAt, log.CompletedAt, log.Comment,
            log.Exercises.OrderBy(e => e.Position).Select(e => new LoggedExerciseResponse(e.Id, e.Position, e.ExerciseId, e.ExerciseNameEs, e.ExerciseNameEn,
                e.SupersetGroup, e.PrescribedSets, e.PrescribedRepsMin, e.PrescribedRepsMax, e.PrescribedWeight, Unit(e.PrescribedWeightUnit),
                e.PrescribedRestSeconds, e.PrescribedTempo, e.PrescribedRir, e.PrescribedRpe, e.PrescribedNotes, e.IsCompleted, e.Comment,
                e.Sets.OrderBy(s => s.SetNumber).Select(s => new LoggedSetResponse(s.SetNumber, RoutineLabels.SetTypes[s.SetType], s.IsPrescribed,
                    s.PrescribedRepsMin, s.PrescribedRepsMax, s.PrescribedWeight, Unit(s.PrescribedWeightUnit), s.PrescribedRestSeconds, s.PrescribedRir,
                    s.PrescribedRpe, s.PrescribedNotes, s.Reps, s.Weight, (int?)s.WeightUnit, s.Rir, s.Rpe, s.IsCompleted, s.Notes)).ToList(),
                mediaByExercise.GetValueOrDefault(e.ExerciseId) ?? [])).ToList());
    }

    /// <summary>Inicia (o retoma, si es el mismo día) un entrenamiento.</summary>
    [HttpPost("sessions")]
    public async Task<IActionResult> Start(StartSessionRequest r, CancellationToken ct)
    {
        if (r.AssignmentId is null || r.RoutineDayId is null)
            return this.ToResponse(LibraryResult.Invalid("routineDayId", "Elige la rutina y el día."), NoContent);
        var result = await training.StartAsync(r.AssignmentId.Value, r.RoutineDayId.Value, ct);
        return this.ToResponse(result, () => Ok(new IdResponse(result.Id)));
    }

    [HttpPut("sessions/{id:int}")]
    public async Task<IActionResult> Save(int id, SaveSessionRequest r, CancellationToken ct)
    {
        var input = new SessionProgressInput(r.Comment, (r.Exercises ?? []).Select(e => new LoggedExerciseInput(e.Id, e.IsCompleted, e.Comment,
            (e.Sets ?? []).Select(s => new LoggedSetInput(s.SetNumber, s.Reps, s.Weight, (WeightUnit?)s.WeightUnit, s.Rir, s.Rpe, s.IsCompleted, s.Notes)).ToList())).ToList());
        return this.ToResponse(await training.SaveProgressAsync(id, input, ct), NoContent);
    }

    [HttpPost("sessions/{id:int}/finish")]
    public async Task<IActionResult> Finish(int id, CancellationToken ct) =>
        this.ToResponse(await training.FinishAsync(id, ct), NoContent);

    private async Task<Dictionary<int, List<PortalMediaResponse>>> MediaForAsync(List<int> exerciseIds, CancellationToken ct)
    {
        var rows = await db.ExerciseMedia.AsNoTracking()
            .Where(m => exerciseIds.Contains(m.ExerciseId) && (m.StoredFileId == null || m.StoredFile!.DeletedAt == null))
            .OrderBy(m => m.SortOrder).ThenBy(m => m.Id)
            .Select(m => new { m.Id, m.ExerciseId, m.MediaType, m.Title, m.ExternalUrl })
            .ToListAsync(ct);
        return rows.GroupBy(m => m.ExerciseId).ToDictionary(g => g.Key, g => g.Select(m => new PortalMediaResponse(m.Id,
            m.MediaType == MediaType.Video ? "Video" : "Image", m.Title, m.ExternalUrl ?? $"/api/portal/media/{m.Id}/content", m.ExternalUrl != null)).ToList());
    }
}
