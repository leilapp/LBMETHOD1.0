using LBMethod.Application.Abstractions;
using LBMethod.Application.Security;
using LBMethod.Domain.Common;
using LBMethod.Domain.Training;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Tracking;

/// <summary>
/// Progreso calculado solo con datos guardados: medidas corporales, cargas de los entrenamientos finalizados y frecuencia.
/// No se rellenan huecos ni se interpolan valores. El peso corporal (medidas) y la carga de los ejercicios
/// (entrenamientos) salen de tablas distintas y nunca se mezclan.
/// </summary>
public class ProgressService(IAppDbContext db, ClientAccess access, TimeProvider clock)
{
    public const decimal KgPerLb = 0.45359237m;
    public const int FrequencyWeeks = 12;

    /// <summary>Progreso de un cliente visible para el usuario actual; null si no lo puede ver.</summary>
    public async Task<ProgressResult?> BuildAsync(int clientId, CancellationToken ct = default)
    {
        if (!await access.VisibleClients().AnyAsync(c => c.Id == clientId, ct)) return null;

        var measurements = await db.Measurements.AsNoTracking().Where(m => m.ClientId == clientId)
            .OrderBy(m => m.MeasuredOn).ThenBy(m => m.Id)
            .Select(m => new { m.Id, m.MeasurementTypeId, m.MeasurementType.NameEs, m.MeasurementType.Kind, m.MeasurementType.SortOrder, m.Unit, m.MeasuredOn, m.Value, m.EvaluationId, m.Notes })
            .ToListAsync(ct);
        var series = measurements.GroupBy(m => new { m.MeasurementTypeId, m.Unit })
            .OrderBy(g => g.First().SortOrder).ThenBy(g => g.Key.Unit)
            .Select(g => new MeasurementSeries(g.Key.MeasurementTypeId, g.First().NameEs, g.First().Kind.ToString(), g.Key.Unit,
                g.Select(m => new MeasurementPoint(m.Id, m.MeasuredOn, m.Value, m.EvaluationId, m.Notes)).ToList()))
            .ToList();

        var sets = await db.TrainingLogs.AsNoTracking()
            .Where(l => l.ClientId == clientId && l.Status == TrainingLogStatus.Completed)
            .SelectMany(l => l.Exercises.SelectMany(e => e.Sets
                .Where(s => s.Weight != null && s.WeightUnit != null && s.Reps != null && s.Reps > 0)
                .Select(s => new { LogId = l.Id, l.StartedAt, e.ExerciseId, e.ExerciseNameEs, Weight = s.Weight!.Value, Unit = s.WeightUnit!.Value, Reps = s.Reps!.Value })))
            .ToListAsync(ct);

        var exercises = sets.GroupBy(s => s.ExerciseId).Select(g =>
        {
            // La gráfica usa la unidad con la que más se registró el ejercicio; lo demás se convierte y se marca.
            var unit = g.GroupBy(s => s.Unit).OrderByDescending(u => u.Count()).ThenBy(u => u.Key).First().Key;
            decimal To(decimal w, WeightUnit from) => from == unit ? w : decimal.Round(unit == WeightUnit.Kg ? w * KgPerLb : w / KgPerLb, 2);
            var points = g.GroupBy(s => s.LogId).Select(session =>
            {
                var top = session.OrderByDescending(s => To(s.Weight, s.Unit)).ThenByDescending(s => s.Reps).First();
                return new LoadPoint(BusinessTime.LocalDate(top.StartedAt), session.Key, To(top.Weight, top.Unit), top.Reps,
                    decimal.Round(session.Sum(s => To(s.Weight, s.Unit) * s.Reps), 2), session.Count(), top.Unit != unit, top.Weight, top.Unit.ToString().ToLowerInvariant());
            }).OrderBy(p => p.Date).ThenBy(p => p.SessionId).ToList();
            var name = g.OrderByDescending(s => s.StartedAt).First().ExerciseNameEs;
            return new ExerciseProgress(g.Key, name, unit.ToString().ToLowerInvariant(), g.Any(s => s.Unit != unit), points);
        }).OrderByDescending(e => e.Points.Count).ThenBy(e => e.Name).ToList();

        var logs = await db.TrainingLogs.AsNoTracking().Where(l => l.ClientId == clientId)
            .Select(l => new { l.StartedAt, l.Status }).ToListAsync(ct);
        var completedDates = logs.Where(l => l.Status == TrainingLogStatus.Completed).Select(l => BusinessTime.LocalDate(l.StartedAt)).ToList();
        var today = BusinessTime.LocalDate(clock.GetUtcNow().UtcDateTime);
        var monday = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var weeks = Enumerable.Range(0, FrequencyWeeks).Select(i => monday.AddDays(-7 * (FrequencyWeeks - 1 - i)))
            .Select(start => new WeekCount(start, completedDates.Count(d => d >= start && d < start.AddDays(7)))).ToList();
        var frequency = new FrequencySummary(completedDates.Count, logs.Count(l => l.Status == TrainingLogStatus.InProgress),
            completedDates.Count > 0 ? completedDates.Min() : null, completedDates.Count > 0 ? completedDates.Max() : null, weeks);

        return new ProgressResult(series, exercises, frequency);
    }
}
