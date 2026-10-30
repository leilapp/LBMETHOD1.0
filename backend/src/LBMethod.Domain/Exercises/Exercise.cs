using LBMethod.Domain.Common;
using LBMethod.Domain.Files;

namespace LBMethod.Domain.Exercises;

public enum ExerciseType
{
    Strength = 1,
    Mobility = 2,
    Cardio = 3,
    Plyometric = 4,
    Isometric = 5,
    Stretching = 6,
    Other = 99
}

public enum Difficulty
{
    Beginner = 1,
    Intermediate = 2,
    Advanced = 3
}

public enum MuscleRole
{
    Primary = 1,
    Secondary = 2
}

public enum MediaType
{
    Image = 1,
    Video = 2
}

/// <summary>
/// Ejercicio del catálogo central. Se registra una sola vez y las rutinas lo reutilizan por Id.
/// Los parámetros de prescripción (series, repeticiones, etc.) NO viven aquí, sino en RoutineExercise.
/// </summary>
public class Exercise : Entity
{
    public string NameEs { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public string? CommonMistakes { get; set; }
    public string? TechnicalTips { get; set; }

    public ExerciseType Type { get; set; } = ExerciseType.Strength;
    public Difficulty? Difficulty { get; set; }
    public int? MovementPatternId { get; set; }
    public MovementPattern? MovementPattern { get; set; }

    /// <summary>Desactivar oculta el ejercicio de la biblioteca sin romper rutinas ni historial.</summary>
    public bool IsActive { get; set; } = true;
    public DateTime? DeactivatedAt { get; set; }

    public ICollection<ExerciseMuscle> Muscles { get; set; } = new List<ExerciseMuscle>();
    public ICollection<ExerciseEquipment> Equipment { get; set; } = new List<ExerciseEquipment>();
    public ICollection<ExerciseVariant> Variants { get; set; } = new List<ExerciseVariant>();
    public ICollection<ExerciseMedia> Media { get; set; } = new List<ExerciseMedia>();
}

/// <summary>Elemento de un catálogo administrable por la entrenadora, con nombre bilingüe.</summary>
public interface ICatalogEntry
{
    int Id { get; }
    string NameEs { get; set; }
    string NameEn { get; set; }
    bool IsActive { get; set; }
}

/// <summary>Grupo muscular administrable por la entrenadora (nombre bilingüe).</summary>
public class MuscleGroup : Entity, ICatalogEntry
{
    public string NameEs { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Equipamiento administrable por la entrenadora (nombre bilingüe).</summary>
public class Equipment : Entity, ICatalogEntry
{
    public string NameEs { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

/// <summary>Patrón de movimiento (bisagra de cadera, sentadilla, empuje…), administrable.</summary>
public class MovementPattern : Entity, ICatalogEntry
{
    public string NameEs { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

/// <summary>Relación ejercicio-músculo. Cada ejercicio tiene como máximo un músculo principal.</summary>
public class ExerciseMuscle
{
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int MuscleGroupId { get; set; }
    public MuscleGroup MuscleGroup { get; set; } = null!;
    public MuscleRole Role { get; set; }
}

public class ExerciseEquipment
{
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int EquipmentId { get; set; }
    public Equipment Equipment { get; set; } = null!;
}

/// <summary>
/// Vínculo entre un ejercicio y otro ejercicio que es su variante. Cada variante es un
/// ejercicio completo del catálogo con su propio Id (identidad clara).
/// </summary>
public class ExerciseVariant
{
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public int VariantExerciseId { get; set; }
    public Exercise VariantExercise { get; set; } = null!;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Imagen o video de un ejercicio: o bien un archivo privado subido (StoredFileId),
/// o bien un enlace externo (ExternalUrl). Nunca ambos.
/// </summary>
public class ExerciseMedia : Entity
{
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public MediaType MediaType { get; set; }
    public Guid? StoredFileId { get; set; }
    public StoredFile? StoredFile { get; set; }
    public string? ExternalUrl { get; set; }
    public string? Title { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>Ejercicio marcado como favorito por un usuario.</summary>
public class ExerciseFavorite
{
    public int UserId { get; set; }
    public int ExerciseId { get; set; }
    public Exercise Exercise { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
