using LBMethod.Domain.Common;

namespace LBMethod.Domain.Calendar;

public enum CalendarEventType
{
    ScheduledTraining = 1,
    RestDay = 2,
    Evaluation = 3,
    ProgramStart = 4,
    ProgramEnd = 5,
    Other = 99
}

public enum CalendarEventStatus
{
    Planned = 1,
    Completed = 2,
    Cancelled = 3
}

/// <summary>
/// Evento del calendario de un cliente (o general de la entrenadora si ClientId es nulo).
/// Las fechas son de calendario (sin zona horaria); la hora es opcional.
/// </summary>
public class CalendarEvent : Entity
{
    public int TrainerId { get; set; }
    public int? ClientId { get; set; }
    public Clients.Client? Client { get; set; }
    public CalendarEventType Type { get; set; }
    public CalendarEventStatus Status { get; set; } = CalendarEventStatus.Planned;
    public string Title { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public TimeOnly? StartTime { get; set; }
    public TimeOnly? EndTime { get; set; }
    public string? Notes { get; set; }

    // Vínculos opcionales con el origen del evento
    public int? RoutineAssignmentId { get; set; }
    public int? RoutineDayId { get; set; }
    public int? TrainingLogId { get; set; }
    public int? EvaluationId { get; set; }
}
