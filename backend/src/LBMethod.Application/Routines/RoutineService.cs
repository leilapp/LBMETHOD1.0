using System.Text.RegularExpressions;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Library;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Routines;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Routines;

/// <summary>
/// Constructor manual de rutinas y plantillas. La entrenadora decide cada día, ejercicio, orden y parámetro;
/// aquí solo se valida y se guarda. Una versión publicada nunca cambia: editarla crea un borrador nuevo
/// que al publicarse se convierte en la siguiente versión. Nada se borra salvo un borrador descartado.
/// </summary>
public partial class RoutineService(IAppDbContext db, ICurrentUser user, TimeProvider clock)
{
    /// <summary>Rutinas y plantillas de la entrenadora actual.</summary>
    public IQueryable<Routine> Owned()
    {
        var userId = user.UserId;
        return db.Routines.Where(r => r.TrainerId == userId);
    }

    /// <summary>Crea una rutina o plantilla con su primer borrador, vacío o copiado de otra versión propia.</summary>
    public async Task<LibraryResult> CreateAsync(RoutineKind kind, RoutineHeaderInput header, int? fromVersionId, CancellationToken ct = default)
    {
        if (!Enum.IsDefined(kind)) return LibraryResult.Invalid("kind", "Tipo de rutina no válido.");
        var errors = new Errors();
        ValidateHeader(header, errors);
        if (errors.Any) return errors.Result();

        RoutineVersion? source = null;
        if (fromVersionId is { } sourceId)
        {
            source = await LoadVersionAsync(sourceId, ct);
            if (source is null) return LibraryResult.NotFound();
        }

        return await db.InTransactionAsync(async () =>
        {
            var routine = new Routine { TrainerId = user.UserId, Kind = kind, Name = header.Title.Trim() };
            var draft = new RoutineVersion { Routine = routine, VersionNumber = 1, SourceVersionId = source?.Id };
            ApplyHeader(draft, header);
            if (source is not null) CopyDays(source, draft);
            db.Routines.Add(routine);
            db.RoutineVersions.Add(draft);
            await db.SaveChangesAsync(ct);
            Audit(source is null ? "RoutineCreated" : "RoutineCreatedFromVersion", routine.Id, source?.Id.ToString());
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(routine.Id);
        }, ct);
    }

    /// <summary>
    /// Guarda el borrador completo (datos, días y ejercicios en el orden recibido).
    /// Se permite guardar incompleto; las reglas para publicar se revisan al publicar.
    /// </summary>
    public async Task<LibraryResult> SaveDraftAsync(int routineId, RoutineDraftInput input, CancellationToken ct = default)
    {
        var routine = await Owned().SingleOrDefaultAsync(r => r.Id == routineId, ct);
        if (routine is null) return LibraryResult.NotFound();
        if (routine.Status == RoutineStatus.Archived) return LibraryResult.Conflict("La rutina está archivada. Restáurala para editarla.");

        var draft = await db.RoutineVersions.SingleOrDefaultAsync(v => v.Id == input.DraftVersionId && v.RoutineId == routineId, ct);
        if (draft is null) return LibraryResult.NotFound();
        if (draft.Status != RoutineVersionStatus.Draft)
            return LibraryResult.Conflict("Este borrador ya se publicó. Recarga la rutina para seguir editando sobre una versión nueva.");

        var errors = new Errors();
        ValidateHeader(input.Header, errors);
        await ValidateDaysAsync(input.Days, errors, forPublish: false, ct);
        if (errors.Any) return errors.Result();

        return await db.InTransactionAsync(async () =>
        {
            // El borrador no lo usa nadie todavía: su contenido se reemplaza completo.
            // (Las versiones publicadas están protegidas y nunca pasan por aquí.)
            await db.RoutineDays.Where(d => d.RoutineVersionId == draft.Id).ExecuteDeleteAsync(ct);
            ApplyHeader(draft, input.Header);
            routine.Name = draft.Title;
            routine.UpdatedAt = clock.GetUtcNow().UtcDateTime;
            var position = 1;
            foreach (var day in input.Days)
                db.RoutineDays.Add(BuildDay(draft.Id, position++, day));
            Audit("RoutineDraftSaved", routineId, draft.Id.ToString());
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(draft.Id);
        }, ct);
    }

    /// <summary>Abre un borrador para editar. Si no existe, se crea copiando la última versión publicada.</summary>
    public async Task<LibraryResult> OpenDraftAsync(int routineId, CancellationToken ct = default)
    {
        var routine = await Owned().SingleOrDefaultAsync(r => r.Id == routineId, ct);
        if (routine is null) return LibraryResult.NotFound();
        if (routine.Status == RoutineStatus.Archived) return LibraryResult.Conflict("La rutina está archivada. Restáurala para editarla.");

        var existing = await db.RoutineVersions.Where(v => v.RoutineId == routineId && v.Status == RoutineVersionStatus.Draft)
            .Select(v => (int?)v.Id).SingleOrDefaultAsync(ct);
        if (existing is { } draftId) return LibraryResult.Ok(draftId);

        var latestId = await db.RoutineVersions.Where(v => v.RoutineId == routineId)
            .OrderByDescending(v => v.VersionNumber).Select(v => v.Id).FirstAsync(ct);
        var latest = (await LoadVersionAsync(latestId, ct))!;
        var draft = new RoutineVersion
        {
            RoutineId = routineId, VersionNumber = latest.VersionNumber + 1, SourceVersionId = latest.Id,
            Title = latest.Title, Description = latest.Description, Goal = latest.Goal, DurationWeeks = latest.DurationWeeks
        };
        CopyDays(latest, draft);
        db.RoutineVersions.Add(draft);
        Audit("RoutineDraftOpened", routineId, latest.Id.ToString());
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(draft.Id);
    }

    /// <summary>Publica el borrador: queda como versión fija y trazable, lista para asignarse.</summary>
    public async Task<LibraryResult> PublishAsync(int routineId, int draftVersionId, string? changeNotes, CancellationToken ct = default)
    {
        var routine = await Owned().SingleOrDefaultAsync(r => r.Id == routineId, ct);
        if (routine is null) return LibraryResult.NotFound();
        if (routine.Status == RoutineStatus.Archived) return LibraryResult.Conflict("La rutina está archivada. Restáurala para publicarla.");
        var draft = await LoadVersionAsync(draftVersionId, ct, tracked: true);
        if (draft is null || draft.RoutineId != routineId) return LibraryResult.NotFound();
        if (draft.Status != RoutineVersionStatus.Draft) return LibraryResult.Conflict("Esta versión ya está publicada.");
        if (changeNotes?.Trim().Length > 1000) return LibraryResult.Invalid("changeNotes", "Máximo 1000 caracteres.");

        var errors = new Errors();
        var asInput = draft.Days.OrderBy(d => d.Position).Select(ToInput).ToList();
        await ValidateDaysAsync(asInput, errors, forPublish: true, ct);
        if (errors.Any) return errors.Result();

        draft.Status = RoutineVersionStatus.Published;
        draft.PublishedAt = clock.GetUtcNow().UtcDateTime;
        draft.PublishedByUserId = user.UserId;
        draft.ChangeNotes = NameNormalizer.CleanOptional(changeNotes);
        Audit("RoutinePublished", routineId, $"v{draft.VersionNumber}");
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(draft.Id);
    }

    /// <summary>Descarta el borrador. Solo si ya existe alguna versión publicada (si no, se archiva la rutina).</summary>
    public async Task<LibraryResult> DiscardDraftAsync(int routineId, CancellationToken ct = default)
    {
        if (!await Owned().AnyAsync(r => r.Id == routineId, ct)) return LibraryResult.NotFound();
        var draft = await db.RoutineVersions.SingleOrDefaultAsync(v => v.RoutineId == routineId && v.Status == RoutineVersionStatus.Draft, ct);
        if (draft is null) return LibraryResult.NotFound();
        if (!await db.RoutineVersions.AnyAsync(v => v.RoutineId == routineId && v.Status == RoutineVersionStatus.Published, ct))
            return LibraryResult.Conflict("Esta rutina no tiene versiones publicadas; en lugar de descartar el borrador, archívala.");

        return await db.InTransactionAsync(async () =>
        {
            await db.RoutineDays.Where(d => d.RoutineVersionId == draft.Id).ExecuteDeleteAsync(ct);
            db.RoutineVersions.Remove(draft);
            Audit("RoutineDraftDiscarded", routineId, $"v{draft.VersionNumber}");
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(routineId);
        }, ct);
    }

    /// <summary>
    /// Copia una versión propia en una rutina nueva: duplicar una rutina, guardarla como plantilla
    /// o crear un programa desde una plantilla. La copia empieza como borrador y no afecta al original.
    /// </summary>
    public Task<LibraryResult> CopyAsync(int sourceVersionId, RoutineKind kind, string? title, CancellationToken ct = default) =>
        CopyInternalAsync(sourceVersionId, kind, title, ct);

    private async Task<LibraryResult> CopyInternalAsync(int sourceVersionId, RoutineKind kind, string? title, CancellationToken ct)
    {
        var source = await LoadVersionAsync(sourceVersionId, ct);
        if (source is null) return LibraryResult.NotFound();
        var header = new RoutineHeaderInput(string.IsNullOrWhiteSpace(title) ? source.Title : title, source.Description, source.Goal, source.DurationWeeks);
        return await CreateAsync(kind, header, sourceVersionId, ct);
    }

    /// <summary>Archivar oculta la rutina de las listas sin borrar versiones ni historial.</summary>
    public async Task<LibraryResult> SetArchivedAsync(int routineId, bool archived, CancellationToken ct = default)
    {
        var routine = await Owned().SingleOrDefaultAsync(r => r.Id == routineId, ct);
        if (routine is null) return LibraryResult.NotFound();
        routine.Status = archived ? RoutineStatus.Archived : RoutineStatus.Active;
        routine.ArchivedAt = archived ? clock.GetUtcNow().UtcDateTime : null;
        Audit(archived ? "RoutineArchived" : "RoutineRestored", routineId, null);
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(routineId);
    }

    /// <summary>Versión con todo su contenido, solo si pertenece a la entrenadora actual.</summary>
    public async Task<RoutineVersion?> LoadVersionAsync(int versionId, CancellationToken ct = default, bool tracked = false)
    {
        var userId = user.UserId;
        var query = db.RoutineVersions
            .Include(v => v.Routine)
            .Include(v => v.Days).ThenInclude(d => d.Exercises).ThenInclude(e => e.Exercise)
            .Include(v => v.Days).ThenInclude(d => d.Exercises).ThenInclude(e => e.SetDetails)
            .Where(v => v.Id == versionId && v.Routine.TrainerId == userId);
        return await (tracked ? query : query.AsNoTracking()).SingleOrDefaultAsync(ct);
    }

    // ---------- Validación ----------

    [GeneratedRegex("^[A-Z0-9]{1,3}$")]
    private static partial Regex SupersetPattern();

    private static void ValidateHeader(RoutineHeaderInput h, Errors errors)
    {
        var title = h.Title?.Trim() ?? string.Empty;
        if (title.Length == 0) errors.Add("title", "Escribe el nombre de la rutina.");
        if (title.Length > 150) errors.Add("title", "Máximo 150 caracteres.");
        if (h.Description?.Trim().Length > 2000) errors.Add("description", "Máximo 2000 caracteres.");
        if (h.Goal?.Trim().Length > 500) errors.Add("goal", "Máximo 500 caracteres.");
        if (h.DurationWeeks is < 1 or > RoutineLimits.MaxDurationWeeks)
            errors.Add("durationWeeks", $"La duración debe estar entre 1 y {RoutineLimits.MaxDurationWeeks} semanas.");
    }

    private async Task ValidateDaysAsync(IReadOnlyList<RoutineDayInput> days, Errors errors, bool forPublish, CancellationToken ct)
    {
        if (days.Count > RoutineLimits.MaxDays) errors.Add("days", $"Máximo {RoutineLimits.MaxDays} días por rutina.");
        if (forPublish && days.Count == 0) errors.Add("days", "Agrega al menos un día con ejercicios antes de publicar.");

        var exerciseIds = days.SelectMany(d => d.Exercises).Select(e => e.ExerciseId).Distinct().ToList();
        var catalog = await db.Exercises.Where(e => exerciseIds.Contains(e.Id))
            .Select(e => new { e.Id, e.NameEs, e.IsActive }).ToDictionaryAsync(e => e.Id, ct);

        for (var d = 0; d < days.Count; d++)
        {
            var day = days[d];
            var p = $"days[{d}]";
            var name = day.Name?.Trim() ?? string.Empty;
            if (name.Length == 0) errors.Add($"{p}.name", "Escribe el nombre del día.");
            if (name.Length > 100) errors.Add($"{p}.name", "Máximo 100 caracteres.");
            if (day.DayOfWeek is { } dow && !Enum.IsDefined(dow)) errors.Add($"{p}.dayOfWeek", "Día de la semana no válido.");
            if (day.Notes?.Trim().Length > 1000) errors.Add($"{p}.notes", "Máximo 1000 caracteres.");
            if (day.Exercises.Count > RoutineLimits.MaxExercisesPerDay)
                errors.Add($"{p}.exercises", $"Máximo {RoutineLimits.MaxExercisesPerDay} ejercicios por día.");
            if (forPublish && day.Exercises.Count == 0) errors.Add($"{p}.exercises", $"El día «{name}» no tiene ejercicios.");

            for (var i = 0; i < day.Exercises.Count; i++)
            {
                var x = day.Exercises[i];
                var xp = $"{p}.exercises[{i}]";
                if (!catalog.TryGetValue(x.ExerciseId, out var master))
                    errors.Add($"{xp}.exerciseId", "El ejercicio no existe en la biblioteca.");
                else if (forPublish && !master.IsActive)
                    errors.Add($"{xp}.exerciseId", $"«{master.NameEs}» está desactivado en la biblioteca. Reactívalo o quítalo antes de publicar.");

                if (x.SupersetGroup is { Length: > 0 } g && !SupersetPattern().IsMatch(g.Trim().ToUpperInvariant()))
                    errors.Add($"{xp}.supersetGroup", "Usa una etiqueta corta, por ejemplo A, B o C1.");
                if (x.Tempo?.Trim().Length > 20) errors.Add($"{xp}.tempo", "Máximo 20 caracteres.");
                if (x.Notes?.Trim().Length > 1000) errors.Add($"{xp}.notes", "Máximo 1000 caracteres.");
                if (!Enum.IsDefined(x.SetType)) errors.Add($"{xp}.setType", "Tipo de serie no válido.");

                if (x.SetDetails.Count == 0)
                {
                    if (x.Sets is < 1 or > RoutineLimits.MaxSets) errors.Add($"{xp}.sets", $"Las series deben estar entre 1 y {RoutineLimits.MaxSets}.");
                }
                else if (x.SetDetails.Count > RoutineLimits.MaxSets)
                    errors.Add($"{xp}.sets", $"Máximo {RoutineLimits.MaxSets} series.");

                ValidatePrescription(errors, xp, x.RepsMin, x.RepsMax, x.SuggestedWeight, x.SuggestedWeightUnit, x.RestSeconds, x.Rir, x.Rpe);
                for (var s = 0; s < x.SetDetails.Count; s++)
                {
                    var set = x.SetDetails[s];
                    var sp = $"{xp}.setDetails[{s}]";
                    if (!Enum.IsDefined(set.SetType)) errors.Add($"{sp}.setType", "Tipo de serie no válido.");
                    if (set.Notes?.Trim().Length > 500) errors.Add($"{sp}.notes", "Máximo 500 caracteres.");
                    ValidatePrescription(errors, sp, set.RepsMin, set.RepsMax, set.SuggestedWeight, set.SuggestedWeightUnit, set.RestSeconds, set.Rir, set.Rpe);
                }
            }

            if (forPublish)
            {
                // Una superserie necesita al menos dos ejercicios del mismo día con la misma etiqueta.
                foreach (var group in day.Exercises.Where(e => !string.IsNullOrWhiteSpace(e.SupersetGroup))
                             .GroupBy(e => e.SupersetGroup!.Trim().ToUpperInvariant()).Where(g => g.Count() < 2))
                    errors.Add($"{p}.exercises", $"La superserie {group.Key} del día «{name}» tiene un solo ejercicio.");
            }
        }
    }

    private static void ValidatePrescription(Errors errors, string p, int? repsMin, int? repsMax, decimal? weight, WeightUnit? unit,
        int? rest, decimal? rir, decimal? rpe)
    {
        if (repsMin is < 0 or > RoutineLimits.MaxReps) errors.Add($"{p}.repsMin", $"Entre 0 y {RoutineLimits.MaxReps}.");
        if (repsMax is < 0 or > RoutineLimits.MaxReps) errors.Add($"{p}.repsMax", $"Entre 0 y {RoutineLimits.MaxReps}.");
        if (repsMin is { } min && repsMax is { } max && min > max) errors.Add($"{p}.repsMax", "El máximo no puede ser menor que el mínimo.");
        if (weight is < 0 or > RoutineLimits.MaxWeight) errors.Add($"{p}.suggestedWeight", $"Entre 0 y {RoutineLimits.MaxWeight}.");
        if (weight is not null && unit is null) errors.Add($"{p}.suggestedWeightUnit", "Indica la unidad del peso (kg o lb).");
        if (unit is { } u && !Enum.IsDefined(u)) errors.Add($"{p}.suggestedWeightUnit", "Unidad no válida.");
        if (rest is < 0 or > RoutineLimits.MaxRestSeconds) errors.Add($"{p}.restSeconds", $"Entre 0 y {RoutineLimits.MaxRestSeconds} segundos.");
        if (rir is < 0 or > 10) errors.Add($"{p}.rir", "El RIR va de 0 a 10.");
        if (rpe is < 1 or > 10) errors.Add($"{p}.rpe", "El RPE va de 1 a 10.");
        if (rir is { } r && decimal.Round(r * 2) != r * 2) errors.Add($"{p}.rir", "Usa enteros o medios (por ejemplo 1.5).");
        if (rpe is { } e && decimal.Round(e * 2) != e * 2) errors.Add($"{p}.rpe", "Usa enteros o medios (por ejemplo 7.5).");
    }

    // ---------- Construcción y copia ----------

    private static void ApplyHeader(RoutineVersion v, RoutineHeaderInput h)
    {
        v.Title = h.Title.Trim();
        v.Description = NameNormalizer.CleanOptional(h.Description);
        v.Goal = NameNormalizer.CleanOptional(h.Goal);
        v.DurationWeeks = h.DurationWeeks;
    }

    private static RoutineDay BuildDay(int versionId, int position, RoutineDayInput input)
    {
        var day = new RoutineDay
        {
            RoutineVersionId = versionId, Position = position, Name = input.Name.Trim(), DayOfWeek = input.DayOfWeek,
            Notes = NameNormalizer.CleanOptional(input.Notes)
        };
        var index = 1;
        foreach (var x in input.Exercises)
        {
            var exercise = new RoutineExercise
            {
                ExerciseId = x.ExerciseId, Position = index++,
                SupersetGroup = string.IsNullOrWhiteSpace(x.SupersetGroup) ? null : x.SupersetGroup.Trim().ToUpperInvariant(),
                // Si hay detalle por serie, el número de series es el número de filas.
                Sets = x.SetDetails.Count > 0 ? x.SetDetails.Count : x.Sets,
                RepsMin = x.RepsMin, RepsMax = x.RepsMax,
                SuggestedWeight = x.SuggestedWeight, SuggestedWeightUnit = x.SuggestedWeight is null ? null : x.SuggestedWeightUnit,
                RestSeconds = x.RestSeconds, Tempo = NameNormalizer.CleanOptional(x.Tempo), Rir = x.Rir, Rpe = x.Rpe,
                SetType = x.SetType, Notes = NameNormalizer.CleanOptional(x.Notes)
            };
            var setNumber = 1;
            foreach (var s in x.SetDetails)
                exercise.SetDetails.Add(new RoutineExerciseSet
                {
                    SetNumber = setNumber++, SetType = s.SetType, RepsMin = s.RepsMin, RepsMax = s.RepsMax,
                    SuggestedWeight = s.SuggestedWeight, SuggestedWeightUnit = s.SuggestedWeight is null ? null : s.SuggestedWeightUnit,
                    RestSeconds = s.RestSeconds, Rir = s.Rir, Rpe = s.Rpe, Notes = NameNormalizer.CleanOptional(s.Notes)
                });
            day.Exercises.Add(exercise);
        }
        return day;
    }

    private static RoutineDayInput ToInput(RoutineDay d) => new(d.Name, d.DayOfWeek, d.Notes,
        d.Exercises.OrderBy(e => e.Position).Select(e => new RoutineExerciseInput(
            e.ExerciseId, e.SupersetGroup, e.Sets, e.RepsMin, e.RepsMax, e.SuggestedWeight, e.SuggestedWeightUnit, e.RestSeconds,
            e.Tempo, e.Rir, e.Rpe, e.SetType, e.Notes,
            e.SetDetails.OrderBy(s => s.SetNumber).Select(s => new RoutineSetInput(
                s.SetType, s.RepsMin, s.RepsMax, s.SuggestedWeight, s.SuggestedWeightUnit, s.RestSeconds, s.Rir, s.Rpe, s.Notes)).ToList()))
            .ToList());

    private static void CopyDays(RoutineVersion source, RoutineVersion target)
    {
        foreach (var day in source.Days.OrderBy(d => d.Position))
        {
            var copy = BuildDay(0, day.Position, ToInput(day));
            copy.RoutineVersion = target;
            target.Days.Add(copy);
        }
    }

    private void Audit(string action, int routineId, string? details) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = user.UserId, Action = action,
        EntityType = nameof(Routine), EntityId = routineId.ToString(), Details = details
    });

    private sealed class Errors
    {
        private readonly Dictionary<string, List<string>> _errors = new();
        public bool Any => _errors.Count > 0;
        public void Add(string field, string message) => (_errors.TryGetValue(field, out var l) ? l : _errors[field] = []).Add(message);
        public LibraryResult Result() => LibraryResult.Invalid(_errors);
    }
}
