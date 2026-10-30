using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Routines;

namespace LBMethod.Domain.Training;

public enum TrainingLogStatus
{
    InProgress = 1,
    Completed = 2
}

/// <summary>
/// Sesión de entrenamiento realizada por un cliente. Guarda una instantánea (snapshot) de lo
/// prescrito y lo realmente hecho, de modo que no cambia si después se edita la rutina.
/// Un cliente solo puede tener una sesión en curso a la vez (evita duplicados al retomar).
/// </summary>
public class TrainingLog : Entity
{
    public int ClientId { get; set; }
    public Clients.Client Client { get; set; } = null!;

    // Referencias de trazabilidad (opcionales); la información visible se toma del snapshot.
    public int? RoutineAssignmentId { get; set; }
    public RoutineAssignment? RoutineAssignment { get; set; }
    public int? RoutineDayId { get; set; }
    public RoutineDay? RoutineDay { get; set; }

    // Snapshot
    public string? RoutineTitle { get; set; }
    public int? RoutineVersionNumber { get; set; }
    public string? DayName { get; set; }

    public TrainingLogStatus Status { get; set; } = TrainingLogStatus.InProgress;
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Comment { get; set; }

    public ICollection<TrainingLogExercise> Exercises { get; set; } = new List<TrainingLogExercise>();
}

/// <summary>Ejercicio dentro de una sesión: snapshot de la prescripción y estado de completado.</summary>
public class TrainingLogExercise : Entity
{
    public int TrainingLogId { get; set; }
    public TrainingLog TrainingLog { get; set; } = null!;
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int? RoutineExerciseId { get; set; }
    public RoutineExercise? RoutineExercise { get; set; }
    public int Position { get; set; }

    // Snapshot de lo prescrito en el momento de iniciar la sesión
    public string ExerciseNameEs { get; set; } = string.Empty;
    public string? ExerciseNameEn { get; set; }
    public string? SupersetGroup { get; set; }
    public int? PrescribedSets { get; set; }
    public int? PrescribedRepsMin { get; set; }
    public int? PrescribedRepsMax { get; set; }
    public decimal? PrescribedWeight { get; set; }
    public WeightUnit? PrescribedWeightUnit { get; set; }
    public int? PrescribedRestSeconds { get; set; }
    public string? PrescribedTempo { get; set; }
    public decimal? PrescribedRir { get; set; }
    public decimal? PrescribedRpe { get; set; }
    public string? PrescribedNotes { get; set; }

    public bool IsCompleted { get; set; }
    public string? Comment { get; set; }

    public ICollection<TrainingLogSet> Sets { get; set; } = new List<TrainingLogSet>();
}

/// <summary>
/// Serie de una sesión: snapshot de lo prescrito para esa serie (si la rutina lo indicaba)
/// y lo realmente ejecutado (repeticiones y peso reales). Las series extra que agrega el cliente no tienen prescripción.
/// </summary>
public class TrainingLogSet : Entity
{
    public int TrainingLogExerciseId { get; set; }
    public TrainingLogExercise TrainingLogExercise { get; set; } = null!;
    public int SetNumber { get; set; }
    public SetType SetType { get; set; } = SetType.Working;

    // Snapshot de lo prescrito para esta serie
    public bool IsPrescribed { get; set; }
    public int? PrescribedRepsMin { get; set; }
    public int? PrescribedRepsMax { get; set; }
    public decimal? PrescribedWeight { get; set; }
    public WeightUnit? PrescribedWeightUnit { get; set; }
    public int? PrescribedRestSeconds { get; set; }
    public decimal? PrescribedRir { get; set; }
    public decimal? PrescribedRpe { get; set; }
    public string? PrescribedNotes { get; set; }

    // Lo realizado
    public int? Reps { get; set; }
    public decimal? Weight { get; set; }
    public WeightUnit? WeightUnit { get; set; }
    public decimal? Rir { get; set; }
    public decimal? Rpe { get; set; }
    public bool IsCompleted { get; set; }
    public string? Notes { get; set; }
}
