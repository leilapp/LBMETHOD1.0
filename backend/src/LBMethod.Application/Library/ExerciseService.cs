using LBMethod.Application.Abstractions;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Exercises;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Library;

/// <summary>
/// Reglas del catálogo central de ejercicios. Cada ejercicio existe una sola vez (sin duplicados
/// por nombre, sin distinguir mayúsculas ni acentos) y nunca se borra: se desactiva, para no
/// romper rutinas ni historial.
/// </summary>
public class ExerciseService(IAppDbContext db, ICurrentUser user, TimeProvider clock)
{
    public async Task<LibraryResult> CreateAsync(ExerciseInput input, CancellationToken ct = default)
    {
        var check = await ValidateAsync(input, exerciseId: null, ct);
        if (!check.Succeeded) return check;

        return await db.InTransactionAsync(async () =>
        {
            var exercise = new Exercise();
            Apply(exercise, input);
            db.Exercises.Add(exercise);
            await db.SaveChangesAsync(ct);
            Audit("ExerciseCreated", exercise.Id);
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(exercise.Id);
        }, ct);
    }

    public async Task<LibraryResult> UpdateAsync(int id, ExerciseInput input, CancellationToken ct = default)
    {
        var exercise = await db.Exercises.Include(e => e.Muscles).Include(e => e.Equipment).SingleOrDefaultAsync(e => e.Id == id, ct);
        if (exercise is null) return LibraryResult.NotFound();

        var check = await ValidateAsync(input, id, ct);
        if (!check.Succeeded) return check;

        return await db.InTransactionAsync(async () =>
        {
            // Si cambia el músculo principal, primero se degrada el anterior: solo puede haber uno.
            var oldPrimary = exercise.Muscles.FirstOrDefault(m => m.Role == MuscleRole.Primary);
            if (oldPrimary is not null && oldPrimary.MuscleGroupId != input.PrimaryMuscleGroupId)
            {
                oldPrimary.Role = MuscleRole.Secondary;
                await db.SaveChangesAsync(ct);
            }

            Apply(exercise, input);
            Audit("ExerciseUpdated", id);
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(id);
        }, ct);
    }

    /// <summary>Desactivar lo oculta de la biblioteca; las rutinas y registros que ya lo usan no cambian.</summary>
    public async Task<LibraryResult> SetActiveAsync(int id, bool active, CancellationToken ct = default)
    {
        var exercise = await db.Exercises.SingleOrDefaultAsync(e => e.Id == id, ct);
        if (exercise is null) return LibraryResult.NotFound();
        exercise.IsActive = active;
        exercise.DeactivatedAt = active ? null : clock.GetUtcNow().UtcDateTime;
        Audit(active ? "ExerciseActivated" : "ExerciseDeactivated", id);
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(id);
    }

    public async Task<LibraryResult> SetFavoriteAsync(int id, bool favorite, CancellationToken ct = default)
    {
        if (!await db.Exercises.AnyAsync(e => e.Id == id, ct)) return LibraryResult.NotFound();
        var userId = user.UserId;
        var existing = await db.ExerciseFavorites.SingleOrDefaultAsync(f => f.UserId == userId && f.ExerciseId == id, ct);
        if (favorite && existing is null) db.ExerciseFavorites.Add(new ExerciseFavorite { UserId = userId, ExerciseId = id, CreatedAt = clock.GetUtcNow().UtcDateTime });
        if (!favorite && existing is not null) db.ExerciseFavorites.Remove(existing);
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(id);
    }

    /// <summary>Vincula dos ejercicios del catálogo como variantes; cada uno conserva su propia identidad.</summary>
    public async Task<LibraryResult> AddVariantAsync(int id, int variantId, string? note, CancellationToken ct = default)
    {
        if (id == variantId) return LibraryResult.Invalid("variantExerciseId", "Un ejercicio no puede ser variante de sí mismo.");
        var found = await db.Exercises.CountAsync(e => e.Id == id || e.Id == variantId, ct);
        if (found < 2) return LibraryResult.NotFound();
        if (await db.ExerciseVariants.AnyAsync(v =>
                (v.ExerciseId == id && v.VariantExerciseId == variantId) || (v.ExerciseId == variantId && v.VariantExerciseId == id), ct))
            return LibraryResult.Duplicate("variantExerciseId", "Estos ejercicios ya están vinculados como variantes.");

        db.ExerciseVariants.Add(new ExerciseVariant { ExerciseId = id, VariantExerciseId = variantId, Note = NameNormalizer.CleanOptional(note), CreatedAt = clock.GetUtcNow().UtcDateTime });
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(id);
    }

    public async Task<LibraryResult> RemoveVariantAsync(int id, int variantId, CancellationToken ct = default)
    {
        var link = await db.ExerciseVariants.SingleOrDefaultAsync(v =>
            (v.ExerciseId == id && v.VariantExerciseId == variantId) || (v.ExerciseId == variantId && v.VariantExerciseId == id), ct);
        if (link is null) return LibraryResult.NotFound();
        db.ExerciseVariants.Remove(link);
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(id);
    }

    private async Task<LibraryResult> ValidateAsync(ExerciseInput input, int? exerciseId, CancellationToken ct)
    {
        var errors = new Dictionary<string, List<string>>();
        void Add(string field, string message) =>
            (errors.TryGetValue(field, out var list) ? list : errors[field] = []).Add(message);

        var nameEs = NameNormalizer.Clean(input.NameEs ?? string.Empty);
        var nameEn = NameNormalizer.CleanOptional(input.NameEn);
        if (nameEs.Length == 0) Add("nameEs", "El nombre en español es obligatorio.");
        if (nameEs.Length > 150) Add("nameEs", "Máximo 150 caracteres.");
        if (nameEn?.Length > 150) Add("nameEn", "Máximo 150 caracteres.");
        if (!Enum.IsDefined(input.Type)) Add("type", "Tipo de ejercicio no válido.");
        if (input.Difficulty is { } d && !Enum.IsDefined(d)) Add("difficulty", "Dificultad no válida.");

        var secondary = input.SecondaryMuscleGroupIds.Distinct().ToList();
        if (secondary.Contains(input.PrimaryMuscleGroupId))
            Add("secondaryMuscleGroupIds", "El grupo principal no puede repetirse como secundario.");
        var muscleIds = secondary.Append(input.PrimaryMuscleGroupId).Distinct().ToList();
        if (await db.MuscleGroups.CountAsync(m => muscleIds.Contains(m.Id), ct) != muscleIds.Count)
            Add("primaryMuscleGroupId", "Algún grupo muscular seleccionado no existe.");
        var equipmentIds = input.EquipmentIds.Distinct().ToList();
        if (await db.Equipment.CountAsync(e => equipmentIds.Contains(e.Id), ct) != equipmentIds.Count)
            Add("equipmentIds", "Algún equipamiento seleccionado no existe.");
        if (input.MovementPatternId is { } p && !await db.MovementPatterns.AnyAsync(m => m.Id == p, ct))
            Add("movementPatternId", "El patrón de movimiento no existe.");

        foreach (var (field, max, value) in new[]
                 {
                     ("description", 2000, input.Description), ("instructions", 4000, input.Instructions),
                     ("commonMistakes", 2000, input.CommonMistakes), ("technicalTips", 2000, input.TechnicalTips)
                 })
            if (value?.Length > max) Add(field, $"Máximo {max} caracteres.");

        if (errors.Count > 0) return LibraryResult.Invalid(errors);

        // La comparación la hace SQL Server con intercalación sin mayúsculas ni acentos.
        var id = exerciseId ?? 0;
        if (await db.Exercises.AnyAsync(e => e.Id != id && (e.NameEs == nameEs || e.NameEn == nameEs), ct))
            return LibraryResult.Duplicate("nameEs", "Ya existe un ejercicio con ese nombre (puede estar desactivado).");
        if (nameEn is not null && await db.Exercises.AnyAsync(e => e.Id != id && (e.NameEn == nameEn || e.NameEs == nameEn), ct))
            return LibraryResult.Duplicate("nameEn", "Ya existe un ejercicio con ese nombre en inglés (puede estar desactivado).");

        return LibraryResult.Ok();
    }

    private static void Apply(Exercise e, ExerciseInput input)
    {
        e.NameEs = NameNormalizer.Clean(input.NameEs);
        e.NameEn = NameNormalizer.CleanOptional(input.NameEn) is { } en ? NameNormalizer.Clean(en) : null;
        e.Description = NameNormalizer.CleanOptional(input.Description);
        e.Instructions = NameNormalizer.CleanOptional(input.Instructions);
        e.CommonMistakes = NameNormalizer.CleanOptional(input.CommonMistakes);
        e.TechnicalTips = NameNormalizer.CleanOptional(input.TechnicalTips);
        e.Type = input.Type;
        e.Difficulty = input.Difficulty;
        e.MovementPatternId = input.MovementPatternId;

        // Se actualizan por diferencia para no borrar y recrear filas con la misma llave.
        var desiredMuscles = input.SecondaryMuscleGroupIds.Distinct()
            .Where(m => m != input.PrimaryMuscleGroupId)
            .ToDictionary(m => m, _ => MuscleRole.Secondary);
        desiredMuscles[input.PrimaryMuscleGroupId] = MuscleRole.Primary;
        foreach (var existing in e.Muscles.Where(m => !desiredMuscles.ContainsKey(m.MuscleGroupId)).ToList())
            e.Muscles.Remove(existing);
        foreach (var (muscleId, role) in desiredMuscles)
        {
            var existing = e.Muscles.FirstOrDefault(m => m.MuscleGroupId == muscleId);
            if (existing is null) e.Muscles.Add(new ExerciseMuscle { MuscleGroupId = muscleId, Role = role });
            else existing.Role = role;
        }

        var desiredEquipment = input.EquipmentIds.ToHashSet();
        foreach (var existing in e.Equipment.Where(x => !desiredEquipment.Contains(x.EquipmentId)).ToList())
            e.Equipment.Remove(existing);
        foreach (var eq in desiredEquipment.Where(eq => e.Equipment.All(x => x.EquipmentId != eq)))
            e.Equipment.Add(new ExerciseEquipment { EquipmentId = eq });
    }

    private void Audit(string action, int id) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = user.UserId, Action = action,
        EntityType = nameof(Exercise), EntityId = id.ToString()
    });
}

/// <summary>Grupos musculares, equipamiento y patrones de movimiento administrables.</summary>
public class CatalogService(IAppDbContext db)
{
    public async Task<LibraryResult> SaveAsync<T>(DbSet<T> set, int? id, CatalogInput input, Func<T> create, CancellationToken ct = default)
        where T : class, ICatalogEntry
    {
        var es = NameNormalizer.Clean(input.NameEs ?? string.Empty);
        var en = NameNormalizer.Clean(input.NameEn ?? string.Empty);
        var errors = new Dictionary<string, List<string>>();
        if (es.Length is 0 or > 100) errors["nameEs"] = ["El nombre en español es obligatorio (máximo 100 caracteres)."];
        if (en.Length is 0 or > 100) errors["nameEn"] = ["El nombre en inglés es obligatorio (máximo 100 caracteres)."];
        if (errors.Count > 0) return LibraryResult.Invalid(errors);

        var currentId = id ?? 0;
        if (await set.AnyAsync(x => x.Id != currentId && x.NameEs == es, ct))
            return LibraryResult.Duplicate("nameEs", "Ya existe un elemento con ese nombre en español.");
        if (await set.AnyAsync(x => x.Id != currentId && x.NameEn == en, ct))
            return LibraryResult.Duplicate("nameEn", "Ya existe un elemento con ese nombre en inglés.");

        T? entity;
        if (id is null)
        {
            entity = create();
            set.Add(entity);
        }
        else
        {
            entity = await set.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (entity is null) return LibraryResult.NotFound();
        }

        entity.NameEs = es;
        entity.NameEn = en;
        entity.IsActive = input.IsActive;
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(entity.Id);
    }
}
