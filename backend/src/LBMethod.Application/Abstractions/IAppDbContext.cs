using LBMethod.Domain.Audit;
using LBMethod.Domain.Calendar;
using LBMethod.Domain.Clients;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Files;
using LBMethod.Domain.Routines;
using LBMethod.Domain.Tracking;
using LBMethod.Domain.Training;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Abstractions;

/// <summary>Acceso a datos que necesitan los casos de uso. Lo implementa la infraestructura (SQL Server).</summary>
public interface IAppDbContext
{
    DbSet<Client> Clients { get; }
    DbSet<ClientNote> ClientNotes { get; }

    DbSet<Exercise> Exercises { get; }
    DbSet<MuscleGroup> MuscleGroups { get; }
    DbSet<Equipment> Equipment { get; }
    DbSet<MovementPattern> MovementPatterns { get; }
    DbSet<ExerciseMuscle> ExerciseMuscles { get; }
    DbSet<ExerciseEquipment> ExerciseEquipment { get; }
    DbSet<ExerciseVariant> ExerciseVariants { get; }
    DbSet<ExerciseMedia> ExerciseMedia { get; }
    DbSet<ExerciseFavorite> ExerciseFavorites { get; }

    DbSet<Routine> Routines { get; }
    DbSet<RoutineVersion> RoutineVersions { get; }
    DbSet<RoutineDay> RoutineDays { get; }
    DbSet<RoutineExercise> RoutineExercises { get; }
    DbSet<RoutineExerciseSet> RoutineExerciseSets { get; }
    DbSet<RoutineAssignment> RoutineAssignments { get; }

    DbSet<TrainingLog> TrainingLogs { get; }

    DbSet<MeasurementType> MeasurementTypes { get; }
    DbSet<Evaluation> Evaluations { get; }
    DbSet<Measurement> Measurements { get; }
    DbSet<ProgressPhoto> ProgressPhotos { get; }
    DbSet<CalendarEvent> CalendarEvents { get; }

    DbSet<StoredFile> StoredFiles { get; }
    DbSet<AuditLog> AuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>Ejecuta varios guardados como una sola operación: o se aplican todos o ninguno.</summary>
    Task<T> InTransactionAsync<T>(Func<Task<T>> work, CancellationToken cancellationToken = default);
}

/// <summary>Almacenamiento privado de archivos (fuera de cualquier carpeta pública).</summary>
public interface IFileStorage
{
    string ProviderName { get; }
    Task SaveAsync(string key, Stream content, CancellationToken ct = default);
    Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
}
