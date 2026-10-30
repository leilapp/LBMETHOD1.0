using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;

namespace LBMethod.Domain.Routines;

public enum RoutineKind
{
    /// <summary>Programa que se puede asignar a clientes.</summary>
    Program = 1,
    /// <summary>Plantilla reutilizable: sirve de punto de partida y no se asigna directamente.</summary>
    Template = 2
}

public enum RoutineStatus
{
    Active = 1,
    Archived = 2
}

public enum RoutineVersionStatus
{
    Draft = 1,
    Published = 2
}

public enum AssignmentStatus
{
    Scheduled = 1,
    Active = 2,
    Completed = 3,
    Cancelled = 4,
    Replaced = 5
}

/// <summary>
/// Identidad de una rutina o plantilla creada manualmente por la entrenadora.
/// Su contenido vive en versiones (RoutineVersion); editar algo publicado crea una versión nueva.
/// </summary>
public class Routine : Entity
{
    public int TrainerId { get; set; }
    public RoutineKind Kind { get; set; } = RoutineKind.Program;
    public string Name { get; set; } = string.Empty;
    public RoutineStatus Status { get; set; } = RoutineStatus.Active;
    public DateTime? ArchivedAt { get; set; }

    public ICollection<RoutineVersion> Versions { get; set; } = new List<RoutineVersion>();
}

/// <summary>
/// Versión concreta del contenido de una rutina. Una versión publicada es inmutable:
/// las asignaciones apuntan a ella y no cambian cuando se edita la rutina.
/// Solo puede existir un borrador por rutina.
/// </summary>
public class RoutineVersion : Entity
{
    public int RoutineId { get; set; }
    public Routine Routine { get; set; } = null!;
    public int VersionNumber { get; set; }
    public RoutineVersionStatus Status { get; set; } = RoutineVersionStatus.Draft;

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Goal { get; set; }
    public int? DurationWeeks { get; set; }
    public string? ChangeNotes { get; set; }

    /// <summary>Versión de origen cuando se crea a partir de una plantilla, una duplicación o una versión anterior.</summary>
    public int? SourceVersionId { get; set; }
    public RoutineVersion? SourceVersion { get; set; }

    public DateTime? PublishedAt { get; set; }
    public int? PublishedByUserId { get; set; }

    public ICollection<RoutineDay> Days { get; set; } = new List<RoutineDay>();
}

/// <summary>Día de entrenamiento dentro de una versión, con nombre y/o día de la semana.</summary>
public class RoutineDay : Entity
{
    public int RoutineVersionId { get; set; }
    public RoutineVersion RoutineVersion { get; set; } = null!;
    public int Position { get; set; }
    public string Name { get; set; } = string.Empty;
    public DayOfWeek? DayOfWeek { get; set; }
    public string? Notes { get; set; }

    public ICollection<RoutineExercise> Exercises { get; set; } = new List<RoutineExercise>();
}

/// <summary>
/// Un ejercicio del catálogo dentro de un día, con los parámetros que decide la entrenadora.
/// Estos parámetros no modifican el ejercicio maestro.
/// </summary>
public class RoutineExercise : Entity
{
    public int RoutineDayId { get; set; }
    public RoutineDay RoutineDay { get; set; } = null!;
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int Position { get; set; }

    /// <summary>Etiqueta de superserie (por ejemplo "A"): ejercicios con la misma etiqueta en el día se hacen juntos.</summary>
    public string? SupersetGroup { get; set; }

    public int Sets { get; set; }
    public int? RepsMin { get; set; }
    public int? RepsMax { get; set; }
    public decimal? SuggestedWeight { get; set; }
    public WeightUnit? SuggestedWeightUnit { get; set; }
    public int? RestSeconds { get; set; }
    public string? Tempo { get; set; }
    public decimal? Rir { get; set; }
    public decimal? Rpe { get; set; }
    public SetType SetType { get; set; } = SetType.Working;
    public string? Notes { get; set; }

    /// <summary>Detalle opcional serie por serie, cuando cada serie lleva parámetros distintos.</summary>
    public ICollection<RoutineExerciseSet> SetDetails { get; set; } = new List<RoutineExerciseSet>();
}

/// <summary>Prescripción opcional de una serie concreta (p. ej. 2 de calentamiento y 3 efectivas).</summary>
public class RoutineExerciseSet : Entity
{
    public int RoutineExerciseId { get; set; }
    public RoutineExercise RoutineExercise { get; set; } = null!;
    public int SetNumber { get; set; }
    public SetType SetType { get; set; } = SetType.Working;
    public int? RepsMin { get; set; }
    public int? RepsMax { get; set; }
    public decimal? SuggestedWeight { get; set; }
    public WeightUnit? SuggestedWeightUnit { get; set; }
    public int? RestSeconds { get; set; }
    public decimal? Rir { get; set; }
    public decimal? Rpe { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// Asignación de una versión concreta de una rutina a un cliente, con vigencia y estado.
/// Cambiar de programa crea otra asignación; las anteriores se conservan como historial.
/// </summary>
public class RoutineAssignment : Entity
{
    public int ClientId { get; set; }
    public Clients.Client Client { get; set; } = null!;
    public int RoutineVersionId { get; set; }
    public RoutineVersion RoutineVersion { get; set; } = null!;
    public int AssignedByUserId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public AssignmentStatus Status { get; set; } = AssignmentStatus.Scheduled;
    public DateTime? StatusChangedAt { get; set; }
    public string? Notes { get; set; }
}
