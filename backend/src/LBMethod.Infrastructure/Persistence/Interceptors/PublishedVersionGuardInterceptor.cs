using LBMethod.Domain.Routines;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace LBMethod.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Última línea de defensa del historial: impide guardar cualquier cambio en una versión de rutina
/// ya publicada o en sus días, ejercicios y series. Para cambiarla hay que crear una versión nueva.
/// </summary>
public sealed class PublishedVersionGuardInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        if (eventData.Context is { } context)
            Guard(context, CollectVersionIds(context), ids => PublishedIn(context, ids).ToList());
        return result;
    }

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        if (eventData.Context is { } context)
        {
            var ids = CollectVersionIds(context);
            var published = ids.Count == 0 ? [] : await PublishedIn(context, ids).ToListAsync(cancellationToken);
            Guard(context, ids, _ => published);
        }
        return result;
    }

    private static void Guard(DbContext context, HashSet<int> ids, Func<HashSet<int>, List<int>> loadPublished)
    {
        foreach (var entry in context.ChangeTracker.Entries<RoutineVersion>())
        {
            if (entry.State is EntityState.Modified or EntityState.Deleted
                && entry.OriginalValues.GetValue<RoutineVersionStatus>(nameof(RoutineVersion.Status)) == RoutineVersionStatus.Published)
            {
                throw new PublishedVersionModificationException(entry.Entity.Id);
            }
        }

        if (ids.Count == 0) return;
        var published = loadPublished(ids);
        if (published.Count > 0)
            throw new PublishedVersionModificationException(published[0]);
    }

    private static IQueryable<int> PublishedIn(DbContext context, HashSet<int> ids) =>
        context.Set<RoutineVersion>().AsNoTracking()
            .Where(v => ids.Contains(v.Id) && v.Status == RoutineVersionStatus.Published)
            .Select(v => v.Id);

    /// <summary>Versiones (ya guardadas) afectadas por cambios en días, ejercicios o series.</summary>
    private static HashSet<int> CollectVersionIds(DbContext context)
    {
        var versionIds = new HashSet<int>();
        var dayIds = new HashSet<int>();
        var exerciseIds = new HashSet<int>();

        foreach (var entry in context.ChangeTracker.Entries().Where(IsChange))
        {
            switch (entry.Entity)
            {
                case RoutineDay:
                    AddFk(entry, nameof(RoutineDay.RoutineVersionId), versionIds);
                    break;
                case RoutineExercise:
                    AddFk(entry, nameof(RoutineExercise.RoutineDayId), dayIds);
                    break;
                case RoutineExerciseSet:
                    AddFk(entry, nameof(RoutineExerciseSet.RoutineExerciseId), exerciseIds);
                    break;
            }
        }

        if (exerciseIds.Count > 0)
            dayIds.UnionWith(context.Set<RoutineExercise>().AsNoTracking()
                .Where(x => exerciseIds.Contains(x.Id)).Select(x => x.RoutineDayId).ToList());
        if (dayIds.Count > 0)
            versionIds.UnionWith(context.Set<RoutineDay>().AsNoTracking()
                .Where(d => dayIds.Contains(d.Id)).Select(d => d.RoutineVersionId).ToList());

        return versionIds;
    }

    private static bool IsChange(EntityEntry e) => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted;

    private static void AddFk(EntityEntry entry, string fk, HashSet<int> target)
    {
        var property = entry.Property(fk);
        // Los Id temporales (negativos) pertenecen a filas nuevas que aún no existen en la base de datos.
        if (!property.IsTemporary && property.CurrentValue is int current && current > 0) target.Add(current);
        if (entry.State != EntityState.Added && property.OriginalValue is int original && original > 0) target.Add(original);
    }
}

public sealed class PublishedVersionModificationException(int versionId)
    : InvalidOperationException($"La versión de rutina {versionId} ya está publicada y no se puede modificar. Crea una nueva versión.")
{
    public int VersionId { get; } = versionId;
}
