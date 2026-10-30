using LBMethod.Domain.Calendar;
using LBMethod.Domain.Tracking;

namespace LBMethod.Application.Tracking;

public record MeasurementTypeInput(string NameEs, string? NameEn, MeasurementKind Kind, string Unit, bool IsActive = true);

public record MeasurementInput(int MeasurementTypeId, decimal? Value, string? Notes);

/// <summary>Evaluación tal como la registra la entrenadora: fecha, notas y las medidas tomadas ese día.</summary>
public record EvaluationInput(DateOnly? EvaluatedOn, string? Notes, IReadOnlyList<MeasurementInput> Measurements);

public record PhotoInput(DateOnly? TakenOn, PhotoCategory? Category, int? EvaluationId, string? Notes);

public record CalendarEventInput(int? ClientId, CalendarEventType Type, string? Title, DateOnly? Date, TimeOnly? StartTime, TimeOnly? EndTime, string? Notes);

public record TrackingLimits(long MaxPhotoBytes);

public static class TrackingLabels
{
    public static readonly IReadOnlyDictionary<MeasurementKind, string> Kinds = new Dictionary<MeasurementKind, string>
    {
        [MeasurementKind.BodyWeight] = "Peso corporal",
        [MeasurementKind.Circumference] = "Perímetro",
        [MeasurementKind.BodyComposition] = "Composición corporal",
        [MeasurementKind.Other] = "Otra",
    };

    /// <summary>Unidades permitidas por tipo de medida: así el peso corporal nunca se registra en centímetros, por ejemplo.</summary>
    public static readonly IReadOnlyDictionary<MeasurementKind, string[]> UnitsByKind = new Dictionary<MeasurementKind, string[]>
    {
        [MeasurementKind.BodyWeight] = ["kg", "lb"],
        [MeasurementKind.Circumference] = ["cm", "in"],
        [MeasurementKind.BodyComposition] = ["%", "kg", "lb"],
        [MeasurementKind.Other] = ["kg", "lb", "cm", "in", "%"],
    };

    /// <summary>Rango razonable de un valor según su unidad, para atrapar errores de captura (por ejemplo, 625 en lugar de 62.5 kg).</summary>
    public static readonly IReadOnlyDictionary<string, (decimal Min, decimal Max)> Ranges = new Dictionary<string, (decimal, decimal)>
    {
        ["kg"] = (1m, 500m),
        ["lb"] = (2m, 1100m),
        ["cm"] = (1m, 300m),
        ["in"] = (0.5m, 120m),
        ["%"] = (0.1m, 100m),
    };

    public static readonly IReadOnlyDictionary<PhotoCategory, string> PhotoCategories = new Dictionary<PhotoCategory, string>
    {
        [PhotoCategory.Front] = "Frente",
        [PhotoCategory.Side] = "Perfil",
        [PhotoCategory.Back] = "Espalda",
        [PhotoCategory.Other] = "Otra",
    };

    /// <summary>Tipos de evento que la entrenadora crea a mano. Inicio y fin de programa salen de las asignaciones.</summary>
    public static readonly IReadOnlyDictionary<CalendarEventType, string> ManualEventTypes = new Dictionary<CalendarEventType, string>
    {
        [CalendarEventType.ScheduledTraining] = "Entrenamiento",
        [CalendarEventType.RestDay] = "Descanso",
        [CalendarEventType.Evaluation] = "Evaluación",
        [CalendarEventType.Other] = "Otro",
    };

    public static readonly IReadOnlyDictionary<CalendarEventStatus, string> EventStatuses = new Dictionary<CalendarEventStatus, string>
    {
        [CalendarEventStatus.Planned] = "Programado",
        [CalendarEventStatus.Completed] = "Hecho",
        [CalendarEventStatus.Cancelled] = "Cancelado",
    };
}

// ---------- Progreso (solo lectura, calculado con datos guardados) ----------

public record MeasurementPoint(int MeasurementId, DateOnly Date, decimal Value, int? EvaluationId, string? Notes);

/// <summary>Historial de un tipo de medida en una sola unidad. Si hubiera valores en otra unidad, forman otra serie: nunca se mezclan.</summary>
public record MeasurementSeries(int MeasurementTypeId, string Name, string Kind, string Unit, IReadOnlyList<MeasurementPoint> Points);

/// <summary>
/// Mejor serie de un ejercicio en un entrenamiento finalizado. Weight está en la unidad de la gráfica;
/// si se registró en otra unidad, OriginalWeight/OriginalUnit conservan lo que se capturó y Converted lo indica.
/// </summary>
public record LoadPoint(DateOnly Date, int SessionId, decimal Weight, int Reps, decimal Volume, int SetsLogged, bool Converted, decimal OriginalWeight, string OriginalUnit);

public record ExerciseProgress(int ExerciseId, string Name, string Unit, bool HasConvertedValues, IReadOnlyList<LoadPoint> Points);

public record WeekCount(DateOnly WeekStart, int Completed);

public record FrequencySummary(int Completed, int InProgress, DateOnly? FirstSession, DateOnly? LastSession, IReadOnlyList<WeekCount> Weeks);

public record ProgressResult(IReadOnlyList<MeasurementSeries> Measurements, IReadOnlyList<ExerciseProgress> Exercises, FrequencySummary Frequency);

// ---------- Calendario ----------

/// <summary>
/// Elemento del calendario. Sale de datos guardados: eventos creados por la entrenadora (CalendarEvents),
/// asignaciones (inicio, fin y días de rutina con día de la semana), entrenamientos registrados y evaluaciones.
/// </summary>
public record CalendarItem(
    string Kind,
    DateOnly Date,
    string Title,
    string? Detail,
    string Status,
    int? ClientId,
    string? ClientName,
    int? EventId,
    int? SessionId,
    int? EvaluationId,
    TimeOnly? StartTime,
    TimeOnly? EndTime,
    string? Notes);
