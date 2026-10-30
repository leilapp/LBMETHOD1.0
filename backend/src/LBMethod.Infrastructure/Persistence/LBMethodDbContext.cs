using LBMethod.Domain.Audit;
using LBMethod.Domain.Calendar;
using LBMethod.Domain.Clients;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Files;
using LBMethod.Domain.Routines;
using LBMethod.Domain.Tracking;
using LBMethod.Domain.Training;
using LBMethod.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace LBMethod.Infrastructure.Persistence;

public class LBMethodDbContext(DbContextOptions<LBMethodDbContext> options)
    : IdentityDbContext<AppUser, AppRole, int>(options)
{
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<ClientNote> ClientNotes => Set<ClientNote>();

    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<MuscleGroup> MuscleGroups => Set<MuscleGroup>();
    public DbSet<Equipment> Equipment => Set<Equipment>();
    public DbSet<MovementPattern> MovementPatterns => Set<MovementPattern>();
    public DbSet<ExerciseMuscle> ExerciseMuscles => Set<ExerciseMuscle>();
    public DbSet<ExerciseEquipment> ExerciseEquipment => Set<ExerciseEquipment>();
    public DbSet<ExerciseVariant> ExerciseVariants => Set<ExerciseVariant>();
    public DbSet<ExerciseMedia> ExerciseMedia => Set<ExerciseMedia>();
    public DbSet<ExerciseFavorite> ExerciseFavorites => Set<ExerciseFavorite>();

    public DbSet<Routine> Routines => Set<Routine>();
    public DbSet<RoutineVersion> RoutineVersions => Set<RoutineVersion>();
    public DbSet<RoutineDay> RoutineDays => Set<RoutineDay>();
    public DbSet<RoutineExercise> RoutineExercises => Set<RoutineExercise>();
    public DbSet<RoutineExerciseSet> RoutineExerciseSets => Set<RoutineExerciseSet>();
    public DbSet<RoutineAssignment> RoutineAssignments => Set<RoutineAssignment>();

    public DbSet<TrainingLog> TrainingLogs => Set<TrainingLog>();
    public DbSet<TrainingLogExercise> TrainingLogExercises => Set<TrainingLogExercise>();
    public DbSet<TrainingLogSet> TrainingLogSets => Set<TrainingLogSet>();

    public DbSet<MeasurementType> MeasurementTypes => Set<MeasurementType>();
    public DbSet<Evaluation> Evaluations => Set<Evaluation>();
    public DbSet<Measurement> Measurements => Set<Measurement>();
    public DbSet<ProgressPhoto> ProgressPhotos => Set<ProgressPhoto>();

    public DbSet<CalendarEvent> CalendarEvents => Set<CalendarEvent>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // La convención de longitud (200) no debe recortar columnas propias de Identity
        // (hash de contraseña, sellos, tokens, claims): esas quedan sin límite.
        foreach (var property in builder.Model.GetEntityTypes()
                     .Where(t => t.ClrType.Namespace?.StartsWith("Microsoft.AspNetCore.Identity") == true
                                 || t.ClrType == typeof(AppUser) || t.ClrType == typeof(AppRole))
                     .SelectMany(t => t.GetProperties())
                     .Where(p => p.ClrType == typeof(string) && p.GetMaxLength() == 200))
        {
            property.SetMaxLength(null);
        }

        builder.ApplyConfigurationsFromAssembly(typeof(LBMethodDbContext).Assembly);

        // Por seguridad del historial, ninguna relación del dominio borra en cascada salvo que
        // su configuración lo indique explícitamente (partes internas de un agregado).
        foreach (var fk in builder.Model.GetEntityTypes()
                     .Where(t => t.ClrType.Namespace?.StartsWith("LBMethod.Domain") == true)
                     .SelectMany(t => t.GetForeignKeys())
                     .Where(fk => ((IConventionForeignKey)fk).GetDeleteBehaviorConfigurationSource() != ConfigurationSource.Explicit))
        {
            fk.DeleteBehavior = DeleteBehavior.Restrict;
        }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Todas las fechas con hora se guardan y se leen como UTC.
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();
        configurationBuilder.Properties<decimal>().HavePrecision(9, 2);
        configurationBuilder.Properties<string>().HaveMaxLength(200);
    }

    private sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
        v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    private sealed class NullableUtcDateTimeConverter() : ValueConverter<DateTime?, DateTime?>(
        v => v.HasValue ? (v.Value.Kind == DateTimeKind.Utc ? v : v.Value.ToUniversalTime()) : v,
        v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);
}
