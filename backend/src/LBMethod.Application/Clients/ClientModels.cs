using LBMethod.Domain.Clients;
using LBMethod.Domain.Common;
using LBMethod.Domain.Routines;

namespace LBMethod.Application.Clients;

/// <summary>Perfil del cliente tal como lo registra la entrenadora. Todo es opcional salvo nombre, apellidos y correo.</summary>
public record ClientProfileInput(
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    DateOnly? BirthDate,
    decimal? Height,
    LengthUnit? HeightUnit,
    decimal? Weight,
    WeightUnit? WeightUnit,
    ExperienceLevel? ExperienceLevel,
    string? Goal,
    TrainingLocation? TrainingLocation,
    WeekDays AvailableDays,
    int? SessionDurationMinutes,
    string? DeclaredLimitations);

/// <summary>Asignación de una versión publicada a uno o varios clientes (cada cliente recibe su propia asignación).</summary>
public record AssignmentInput(IReadOnlyList<int> ClientIds, int RoutineVersionId, DateOnly StartDate, DateOnly? EndDate, string? Notes);

public static class ClientLimits
{
    public const int MaxNoteLength = 4000;
    public const int MaxAssignmentNotes = 1000;
    public const int MaxClientsPerAssignment = 50;
}

/// <summary>Textos en español para los valores del perfil y de las asignaciones.</summary>
public static class ClientLabels
{
    public static readonly IReadOnlyDictionary<ExperienceLevel, string> Experience = new Dictionary<ExperienceLevel, string>
    {
        [ExperienceLevel.Beginner] = "Principiante",
        [ExperienceLevel.Intermediate] = "Intermedio",
        [ExperienceLevel.Advanced] = "Avanzado"
    };

    public static readonly IReadOnlyDictionary<TrainingLocation, string> Locations = new Dictionary<TrainingLocation, string>
    {
        [TrainingLocation.Gym] = "Gimnasio",
        [TrainingLocation.Home] = "Casa",
        [TrainingLocation.Outdoor] = "Exterior",
        [TrainingLocation.Mixed] = "Mixto"
    };

    public static readonly IReadOnlyList<(WeekDays Day, string Label)> Days =
    [
        (WeekDays.Monday, "Lunes"), (WeekDays.Tuesday, "Martes"), (WeekDays.Wednesday, "Miércoles"), (WeekDays.Thursday, "Jueves"),
        (WeekDays.Friday, "Viernes"), (WeekDays.Saturday, "Sábado"), (WeekDays.Sunday, "Domingo")
    ];

    public static readonly IReadOnlyDictionary<AssignmentStatus, string> Statuses = new Dictionary<AssignmentStatus, string>
    {
        [AssignmentStatus.Scheduled] = "Programada",
        [AssignmentStatus.Active] = "Vigente",
        [AssignmentStatus.Completed] = "Terminada",
        [AssignmentStatus.Cancelled] = "Cancelada",
        [AssignmentStatus.Replaced] = "Reemplazada"
    };

    public static IReadOnlyList<string> DayNames(WeekDays days) => Days.Where(d => days.HasFlag(d.Day)).Select(d => d.Label).ToList();
}

/// <summary>
/// Estado real de una asignación en una fecha. Cancelada, reemplazada o terminada a mano se respetan;
/// en otro caso el estado se deduce de las fechas (programada → vigente → terminada), sin tareas automáticas.
/// </summary>
public static class AssignmentState
{
    public static AssignmentStatus Effective(AssignmentStatus stored, DateOnly start, DateOnly? end, DateOnly today) => stored switch
    {
        AssignmentStatus.Cancelled or AssignmentStatus.Replaced or AssignmentStatus.Completed => stored,
        _ when start > today => AssignmentStatus.Scheduled,
        _ when end is { } e && e < today => AssignmentStatus.Completed,
        _ => AssignmentStatus.Active
    };

    /// <summary>Vigente o por empezar: cuenta como programa actual del cliente.</summary>
    public static bool IsCurrent(AssignmentStatus effective) => effective is AssignmentStatus.Active or AssignmentStatus.Scheduled;
}
