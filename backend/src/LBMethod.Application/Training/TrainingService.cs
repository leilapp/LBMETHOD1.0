using LBMethod.Application.Abstractions;
using LBMethod.Application.Clients;
using LBMethod.Application.Library;
using LBMethod.Application.Security;
using LBMethod.Domain.Common;
using LBMethod.Domain.Routines;
using LBMethod.Domain.Training;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Training;

/// <summary>
/// Registro de entrenamientos del cliente. Al iniciar se copia lo prescrito (snapshot) para que el historial
/// no cambie aunque la rutina se edite después. El cliente nunca modifica la rutina: solo registra lo que hizo.
/// Solo hay una sesión en curso por cliente: retomarla continúa la misma, sin duplicados.
/// </summary>
public class TrainingService(IAppDbContext db, ClientAccess access, TimeProvider clock)
{
    public DateOnly Today() => BusinessTime.LocalDate(clock.GetUtcNow().UtcDateTime);

    /// <summary>Sesiones del cliente actual (vacío para cualquier otro usuario).</summary>
    public async Task<IQueryable<TrainingLog>> MineAsync(CancellationToken ct)
    {
        var clientId = await access.CurrentClientIdAsync(ct);
        return clientId is null ? db.TrainingLogs.Where(_ => false) : db.TrainingLogs.Where(l => l.ClientId == clientId);
    }

    /// <summary>
    /// Inicia el entrenamiento de un día de una asignación vigente. Si ya está en curso ese mismo día, lo retoma.
    /// Si hay otro en curso, se pide terminarlo o retomarlo primero.
    /// </summary>
    public async Task<LibraryResult> StartAsync(int assignmentId, int routineDayId, CancellationToken ct = default)
    {
        var clientId = await access.CurrentClientIdAsync(ct);
        if (clientId is null) return LibraryResult.NotFound();

        var assignment = await db.RoutineAssignments.Include(a => a.RoutineVersion)
            .SingleOrDefaultAsync(a => a.Id == assignmentId && a.ClientId == clientId, ct);
        if (assignment is null) return LibraryResult.NotFound();
        var status = AssignmentState.Effective(assignment.Status, assignment.StartDate, assignment.EndDate, Today());
        if (status == AssignmentStatus.Scheduled) return LibraryResult.Conflict($"Esta rutina empieza el {assignment.StartDate:dd/MM/yyyy}.");
        if (status != AssignmentStatus.Active) return LibraryResult.Conflict("Esta rutina ya no está vigente.");

        var day = await db.RoutineDays
            .Include(d => d.Exercises).ThenInclude(e => e.Exercise)
            .Include(d => d.Exercises).ThenInclude(e => e.SetDetails)
            .SingleOrDefaultAsync(d => d.Id == routineDayId && d.RoutineVersionId == assignment.RoutineVersionId, ct);
        if (day is null) return LibraryResult.NotFound();

        var open = await db.TrainingLogs.Where(l => l.ClientId == clientId && l.Status == TrainingLogStatus.InProgress)
            .Select(l => new { l.Id, l.RoutineAssignmentId, l.RoutineDayId, l.DayName }).SingleOrDefaultAsync(ct);
        if (open is not null)
            return open.RoutineAssignmentId == assignmentId && open.RoutineDayId == routineDayId
                ? LibraryResult.Ok(open.Id)
                : LibraryResult.Conflict($"Tienes un entrenamiento en curso («{open.DayName}»). Termínalo o retómalo antes de empezar otro.");

        var log = new TrainingLog
        {
            ClientId = clientId.Value, RoutineAssignmentId = assignment.Id, RoutineDayId = day.Id,
            RoutineTitle = assignment.RoutineVersion.Title, RoutineVersionNumber = assignment.RoutineVersion.VersionNumber,
            DayName = day.Name, StartedAt = clock.GetUtcNow().UtcDateTime
        };
        foreach (var e in day.Exercises.OrderBy(x => x.Position)) log.Exercises.Add(Snapshot(e));
        db.TrainingLogs.Add(log);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Dos inicios simultáneos (por ejemplo, doble toque): el índice único impide la sesión duplicada.
            return LibraryResult.Conflict("Ya tienes un entrenamiento en curso. Recarga la página para retomarlo.");
        }
        return LibraryResult.Ok(log.Id);
    }

    private static TrainingLogExercise Snapshot(RoutineExercise e)
    {
        var x = new TrainingLogExercise
        {
            ExerciseId = e.ExerciseId, RoutineExerciseId = e.Id, Position = e.Position,
            ExerciseNameEs = e.Exercise.NameEs, ExerciseNameEn = e.Exercise.NameEn, SupersetGroup = e.SupersetGroup,
            PrescribedSets = e.Sets, PrescribedRepsMin = e.RepsMin, PrescribedRepsMax = e.RepsMax,
            PrescribedWeight = e.SuggestedWeight, PrescribedWeightUnit = e.SuggestedWeightUnit, PrescribedRestSeconds = e.RestSeconds,
            PrescribedTempo = e.Tempo, PrescribedRir = e.Rir, PrescribedRpe = e.Rpe, PrescribedNotes = e.Notes
        };
        var details = e.SetDetails.OrderBy(s => s.SetNumber).ToList();
        if (details.Count > 0)
        {
            foreach (var s in details)
                x.Sets.Add(new TrainingLogSet
                {
                    SetNumber = s.SetNumber, SetType = s.SetType, IsPrescribed = true,
                    PrescribedRepsMin = s.RepsMin, PrescribedRepsMax = s.RepsMax, PrescribedWeight = s.SuggestedWeight,
                    PrescribedWeightUnit = s.SuggestedWeightUnit, PrescribedRestSeconds = s.RestSeconds, PrescribedRir = s.Rir,
                    PrescribedRpe = s.Rpe, PrescribedNotes = s.Notes
                });
        }
        else
        {
            for (var n = 1; n <= e.Sets; n++)
                x.Sets.Add(new TrainingLogSet
                {
                    SetNumber = n, SetType = e.SetType, IsPrescribed = true,
                    PrescribedRepsMin = e.RepsMin, PrescribedRepsMax = e.RepsMax, PrescribedWeight = e.SuggestedWeight,
                    PrescribedWeightUnit = e.SuggestedWeightUnit, PrescribedRestSeconds = e.RestSeconds, PrescribedRir = e.Rir, PrescribedRpe = e.Rpe
                });
        }
        return x;
    }

    /// <summary>
    /// Guarda el avance completo de una sesión en curso. Se puede llamar las veces que sea (guardado automático):
    /// actualiza lo realizado sin tocar lo prescrito y sin duplicar series.
    /// </summary>
    public async Task<LibraryResult> SaveProgressAsync(int logId, SessionProgressInput input, CancellationToken ct = default)
    {
        var log = await (await MineAsync(ct)).Include(l => l.Exercises).ThenInclude(e => e.Sets).SingleOrDefaultAsync(l => l.Id == logId, ct);
        if (log is null) return LibraryResult.NotFound();
        if (log.Status != TrainingLogStatus.InProgress) return LibraryResult.Conflict("Este entrenamiento ya se finalizó; queda en tu historial.");

        var errors = Validate(input, log);
        if (errors.Count > 0) return LibraryResult.Invalid(errors);

        log.Comment = Opt(input.Comment);
        foreach (var ex in input.Exercises)
        {
            var target = log.Exercises.Single(e => e.Id == ex.Id);
            target.IsCompleted = ex.IsCompleted;
            target.Comment = Opt(ex.Comment);
            var incoming = ex.Sets.ToDictionary(s => s.SetNumber);
            // Una serie extra que el cliente quitó se elimina; las prescritas se conservan siempre.
            foreach (var extra in target.Sets.Where(s => !s.IsPrescribed && !incoming.ContainsKey(s.SetNumber)).ToList())
                target.Sets.Remove(extra);
            foreach (var s in ex.Sets)
            {
                var set = target.Sets.SingleOrDefault(x => x.SetNumber == s.SetNumber);
                if (set is null)
                {
                    set = new TrainingLogSet { SetNumber = s.SetNumber, SetType = SetType.Working };
                    target.Sets.Add(set);
                }
                set.Reps = s.Reps;
                set.Weight = s.Weight;
                set.WeightUnit = s.Weight is null ? null : s.WeightUnit;
                set.Rir = s.Rir;
                set.Rpe = s.Rpe;
                set.IsCompleted = s.IsCompleted;
                set.Notes = Opt(s.Notes);
            }
        }
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(log.Id);
    }

    /// <summary>Finaliza la sesión, aunque haya ejercicios sin completar. Después ya no se edita.</summary>
    public async Task<LibraryResult> FinishAsync(int logId, CancellationToken ct = default)
    {
        var log = await (await MineAsync(ct)).SingleOrDefaultAsync(l => l.Id == logId, ct);
        if (log is null) return LibraryResult.NotFound();
        if (log.Status != TrainingLogStatus.InProgress) return LibraryResult.Conflict("Este entrenamiento ya se finalizó.");
        log.Status = TrainingLogStatus.Completed;
        log.CompletedAt = clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(log.Id);
    }

    private static Dictionary<string, List<string>> Validate(SessionProgressInput input, TrainingLog log)
    {
        var errors = new Dictionary<string, List<string>>();
        void Add(string field, string message) => (errors.TryGetValue(field, out var l) ? l : errors[field] = []).Add(message);

        if (input.Comment is { Length: > TrainingLimits.MaxSessionComment }) Add("comment", $"Máximo {TrainingLimits.MaxSessionComment} caracteres.");
        var ids = log.Exercises.Select(e => e.Id).ToHashSet();
        if (input.Exercises.Select(e => e.Id).Distinct().Count() != input.Exercises.Count) Add("exercises", "Ejercicio repetido.");

        for (var i = 0; i < input.Exercises.Count; i++)
        {
            var ex = input.Exercises[i];
            var p = $"exercises[{i}]";
            if (!ids.Contains(ex.Id)) { Add(p, "El ejercicio no pertenece a este entrenamiento."); continue; }
            if (ex.Comment is { Length: > TrainingLimits.MaxExerciseComment }) Add($"{p}.comment", $"Máximo {TrainingLimits.MaxExerciseComment} caracteres.");

            var target = log.Exercises.Single(e => e.Id == ex.Id);
            var prescribed = target.Sets.Where(s => s.IsPrescribed).Select(s => s.SetNumber).ToHashSet();
            var numbers = ex.Sets.Select(s => s.SetNumber).ToList();
            if (numbers.Distinct().Count() != numbers.Count) Add($"{p}.sets", "Serie repetida.");
            if (!prescribed.All(numbers.Contains)) Add($"{p}.sets", "Las series indicadas por tu entrenadora no se pueden quitar.");
            if (numbers.Count - prescribed.Count > TrainingLimits.MaxExtraSets) Add($"{p}.sets", $"Máximo {TrainingLimits.MaxExtraSets} series extra.");

            for (var k = 0; k < ex.Sets.Count; k++)
            {
                var s = ex.Sets[k];
                var sp = $"{p}.sets[{k}]";
                if (s.SetNumber is < 1 or > 100) Add($"{sp}.setNumber", "Número de serie no válido.");
                if (s.Reps is { } r && r is < 0 or > TrainingLimits.MaxReps) Add($"{sp}.reps", $"De 0 a {TrainingLimits.MaxReps}.");
                if (s.Weight is { } w)
                {
                    if (w is < 0 or > TrainingLimits.MaxWeight) Add($"{sp}.weight", $"De 0 a {TrainingLimits.MaxWeight}.");
                    if (s.WeightUnit is not { } u || !Enum.IsDefined(u)) Add($"{sp}.weightUnit", "Elige kg o lb.");
                }
                if (s.Rir is { } rir && (rir is < 0 or > 10 || rir * 2 != Math.Floor(rir * 2))) Add($"{sp}.rir", "De 0 a 10, en pasos de 0.5.");
                if (s.Rpe is { } rpe && (rpe is < 1 or > 10 || rpe * 2 != Math.Floor(rpe * 2))) Add($"{sp}.rpe", "De 1 a 10, en pasos de 0.5.");
                if (s.Notes is { Length: > TrainingLimits.MaxSetNotes }) Add($"{sp}.notes", $"Máximo {TrainingLimits.MaxSetNotes} caracteres.");
            }
        }
        return errors;
    }

    private static string? Opt(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
