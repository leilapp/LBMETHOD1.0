using LBMethod.Domain.Common;

namespace LBMethod.Application.Routines;

/// <summary>Datos generales de la rutina (se guardan en cada versión).</summary>
public record RoutineHeaderInput(string Title, string? Description, string? Goal, int? DurationWeeks);

/// <summary>Prescripción de una serie concreta, cuando la entrenadora detalla serie por serie.</summary>
public record RoutineSetInput(
    SetType SetType,
    int? RepsMin,
    int? RepsMax,
    decimal? SuggestedWeight,
    WeightUnit? SuggestedWeightUnit,
    int? RestSeconds,
    decimal? Rir,
    decimal? Rpe,
    string? Notes);

/// <summary>Un ejercicio de la biblioteca dentro de un día, con los parámetros que decide la entrenadora.</summary>
public record RoutineExerciseInput(
    int ExerciseId,
    string? SupersetGroup,
    int Sets,
    int? RepsMin,
    int? RepsMax,
    decimal? SuggestedWeight,
    WeightUnit? SuggestedWeightUnit,
    int? RestSeconds,
    string? Tempo,
    decimal? Rir,
    decimal? Rpe,
    SetType SetType,
    string? Notes,
    IReadOnlyList<RoutineSetInput> SetDetails);

public record RoutineDayInput(string Name, DayOfWeek? DayOfWeek, string? Notes, IReadOnlyList<RoutineExerciseInput> Exercises);

/// <summary>
/// El borrador completo tal como está en el constructor. El orden de los días y de los ejercicios
/// es el orden de las listas. DraftVersionId evita guardar sobre un borrador que ya se publicó.
/// </summary>
public record RoutineDraftInput(int DraftVersionId, RoutineHeaderInput Header, IReadOnlyList<RoutineDayInput> Days);

public static class RoutineLimits
{
    public const int MaxDays = 14;
    public const int MaxExercisesPerDay = 40;
    public const int MaxSets = 30;
    public const int MaxReps = 1000;
    public const decimal MaxWeight = 2000m;
    public const int MaxRestSeconds = 3600;
    public const int MaxDurationWeeks = 104;
}

public static class RoutineLabels
{
    public static readonly IReadOnlyDictionary<SetType, string> SetTypes = new Dictionary<SetType, string>
    {
        [SetType.Working] = "Efectiva",
        [SetType.Warmup] = "Calentamiento",
        [SetType.Dropset] = "Dropset",
        [SetType.Failure] = "Al fallo",
        [SetType.RestPause] = "Rest-pause",
        [SetType.Backoff] = "Back-off",
        [SetType.Other] = "Otra",
    };

    public static readonly IReadOnlyDictionary<DayOfWeek, string> Days = new Dictionary<DayOfWeek, string>
    {
        [DayOfWeek.Monday] = "Lunes",
        [DayOfWeek.Tuesday] = "Martes",
        [DayOfWeek.Wednesday] = "Miércoles",
        [DayOfWeek.Thursday] = "Jueves",
        [DayOfWeek.Friday] = "Viernes",
        [DayOfWeek.Saturday] = "Sábado",
        [DayOfWeek.Sunday] = "Domingo",
    };
}
