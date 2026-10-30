using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Files;
using LBMethod.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace LBMethod.Infrastructure.Persistence.Interceptors;

/// <summary>Asigna CreatedAt y UpdatedAt en UTC al guardar.</summary>
public sealed class AuditTimestampsInterceptor(TimeProvider clock) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Apply(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Apply(eventData.Context);
        return ValueTask.FromResult(result);
    }

    private void Apply(DbContext? context)
    {
        if (context is null) return;
        var now = clock.GetUtcNow().UtcDateTime;

        foreach (var entry in context.ChangeTracker.Entries())
        {
            switch (entry.Entity)
            {
                case Entity e when entry.State == EntityState.Added:
                    e.CreatedAt = now;
                    e.UpdatedAt = now;
                    break;
                case Entity e when entry.State == EntityState.Modified:
                    e.UpdatedAt = now;
                    entry.Property(nameof(Entity.CreatedAt)).IsModified = false;
                    break;
                case AppUser u when entry.State == EntityState.Added:
                    u.CreatedAt = now;
                    u.UpdatedAt = now;
                    break;
                case AppUser u when entry.State == EntityState.Modified:
                    u.UpdatedAt = now;
                    break;
                case StoredFile f when entry.State == EntityState.Added && f.CreatedAt == default:
                    f.CreatedAt = now;
                    break;
                case ExerciseVariant v when entry.State == EntityState.Added && v.CreatedAt == default:
                    v.CreatedAt = now;
                    break;
                case ExerciseFavorite fav when entry.State == EntityState.Added && fav.CreatedAt == default:
                    fav.CreatedAt = now;
                    break;
            }
        }
    }
}
