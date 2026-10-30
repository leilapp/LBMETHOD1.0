using LBMethod.Api.Contracts;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Routines;
using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Training;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers;

/// <summary>
/// Consultas de entrenamientos registrados, compartidas por el portal del cliente y por el seguimiento de la entrenadora.
/// Quien llama decide qué sesiones son visibles (las del cliente actual, o las de un cliente de la entrenadora).
/// </summary>
public static class SessionQueries
{
    private static string? Unit(WeightUnit? u) => u?.ToString().ToLowerInvariant();

    public static IQueryable<SessionSummaryResponse> Summaries(IQueryable<TrainingLog> q) => q.Select(l => new SessionSummaryResponse(
        l.Id, l.RoutineTitle, l.RoutineVersionNumber, l.DayName, l.Status == TrainingLogStatus.InProgress ? "InProgress" : "Completed",
        l.StartedAt, l.CompletedAt, l.Exercises.Count(e => e.IsCompleted), l.Exercises.Count(), l.Exercises.SelectMany(e => e.Sets).Count(s => s.IsCompleted)));

    public static async Task<SessionDetailResponse?> DetailAsync(IQueryable<TrainingLog> visible, int id, IAppDbContext db, Func<int, string> mediaUrl, CancellationToken ct)
    {
        var log = await visible.AsNoTracking()
            .Include(l => l.Exercises).ThenInclude(e => e.Sets)
            .AsSplitQuery()
            .SingleOrDefaultAsync(l => l.Id == id, ct);
        if (log is null) return null;
        var mediaByExercise = await MediaForAsync(db, log.Exercises.Select(e => e.ExerciseId).Distinct().ToList(), mediaUrl, ct);
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

    public static async Task<Dictionary<int, List<PortalMediaResponse>>> MediaForAsync(IAppDbContext db, List<int> exerciseIds, Func<int, string> mediaUrl, CancellationToken ct)
    {
        var rows = await db.ExerciseMedia.AsNoTracking()
            .Where(m => exerciseIds.Contains(m.ExerciseId) && (m.StoredFileId == null || m.StoredFile!.DeletedAt == null))
            .OrderBy(m => m.SortOrder).ThenBy(m => m.Id)
            .Select(m => new { m.Id, m.ExerciseId, m.MediaType, m.Title, m.ExternalUrl })
            .ToListAsync(ct);
        return rows.GroupBy(m => m.ExerciseId).ToDictionary(g => g.Key, g => g.Select(m => new PortalMediaResponse(m.Id,
            m.MediaType == MediaType.Video ? "Video" : "Image", m.Title, m.ExternalUrl ?? mediaUrl(m.Id), m.ExternalUrl != null)).ToList());
    }
}
