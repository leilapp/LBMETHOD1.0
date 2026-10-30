using LBMethod.Application.Abstractions;
using LBMethod.Application.Library;
using LBMethod.Application.Security;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Calendar;
using LBMethod.Domain.Common;
using LBMethod.Domain.Routines;
using LBMethod.Domain.Training;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Tracking;

/// <summary>
/// Calendario de entrenamientos. Une datos guardados: eventos que crea la entrenadora (CalendarEvents), las asignaciones
/// (inicio, fin y días de rutina que tienen día de la semana), los entrenamientos registrados y las evaluaciones.
/// Los descansos solo se deducen cuando todos los días de la rutina tienen día de la semana; si no, no se inventan.
/// </summary>
public class CalendarService(IAppDbContext db, ICurrentUser user, ClientAccess access, TimeProvider clock)
{
    public const int MaxRangeDays = 62;
    public const int MaxTitle = 150;
    public const int MaxNotes = 1000;

    public static class Kinds
    {
        public const string Planned = "planned";
        public const string Rest = "rest";
        public const string Session = "session";
        public const string Evaluation = "evaluation";
        public const string Training = "training";
        public const string Other = "other";
        public const string ProgramStart = "program-start";
        public const string ProgramEnd = "program-end";
    }

    // ---------- Eventos de la entrenadora ----------

    public async Task<LibraryResult> CreateAsync(CalendarEventInput input, CancellationToken ct = default)
    {
        var errors = await ValidateAsync(input, ct);
        if (errors is null) return LibraryResult.NotFound();
        if (errors.Count > 0) return LibraryResult.Invalid(errors);
        var e = new CalendarEvent { TrainerId = user.UserId };
        Apply(e, input);
        db.CalendarEvents.Add(e);
        await db.SaveChangesAsync(ct);
        Audit("CalendarEventCreated", e.Id, $"{e.Type} {e.Date:yyyy-MM-dd}");
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(e.Id);
    }

    public async Task<LibraryResult> UpdateAsync(int id, CalendarEventInput input, CancellationToken ct = default)
    {
        var e = await Owned().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return LibraryResult.NotFound();
        if (e.Status != CalendarEventStatus.Planned) return LibraryResult.Conflict("Solo se editan eventos programados.");
        var errors = await ValidateAsync(input, ct);
        if (errors is null) return LibraryResult.NotFound();
        if (errors.Count > 0) return LibraryResult.Invalid(errors);
        Apply(e, input);
        Audit("CalendarEventUpdated", e.Id, $"{e.Type} {e.Date:yyyy-MM-dd}");
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(e.Id);
    }

    /// <summary>Marca el evento como hecho o cancelado. Nunca se borra: queda en el calendario con su estado.</summary>
    public async Task<LibraryResult> SetStatusAsync(int id, CalendarEventStatus status, CancellationToken ct = default)
    {
        var e = await Owned().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return LibraryResult.NotFound();
        if (status == CalendarEventStatus.Planned || !Enum.IsDefined(status)) return LibraryResult.Invalid("status", "Estado no válido.");
        if (e.Status != CalendarEventStatus.Planned) return LibraryResult.Conflict("Este evento ya no está programado.");
        e.Status = status;
        Audit(status == CalendarEventStatus.Cancelled ? "CalendarEventCancelled" : "CalendarEventCompleted", e.Id, null);
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(e.Id);
    }

    private IQueryable<CalendarEvent> Owned()
    {
        var userId = user.UserId;
        return db.CalendarEvents.Where(e => e.TrainerId == userId);
    }

    private static void Apply(CalendarEvent e, CalendarEventInput input)
    {
        e.ClientId = input.ClientId;
        e.Type = input.Type;
        e.Title = string.IsNullOrWhiteSpace(input.Title) ? TrackingLabels.ManualEventTypes[input.Type] : NameNormalizer.Clean(input.Title);
        e.Date = input.Date!.Value;
        e.StartTime = input.StartTime;
        e.EndTime = input.EndTime;
        e.Notes = NameNormalizer.CleanOptional(input.Notes);
    }

    /// <summary>Errores por campo; null si el cliente indicado no es de la entrenadora.</summary>
    private async Task<Dictionary<string, List<string>>?> ValidateAsync(CalendarEventInput input, CancellationToken ct)
    {
        if (input.ClientId is { } clientId && !await access.TrainerOwnsClientAsync(clientId, ct)) return null;
        var errors = new Dictionary<string, List<string>>();
        void Add(string f, string m) => (errors.TryGetValue(f, out var l) ? l : errors[f] = []).Add(m);
        if (!TrackingLabels.ManualEventTypes.ContainsKey(input.Type)) Add("type", "Elige el tipo de evento.");
        if (input.Date is not { } date || date.Year < 2000) Add("date", "Indica la fecha.");
        if (input.Title is { Length: > MaxTitle }) Add("title", $"Máximo {MaxTitle} caracteres.");
        if (input.Notes is { Length: > MaxNotes }) Add("notes", $"Máximo {MaxNotes} caracteres.");
        if (input.EndTime is not null && input.StartTime is null) Add("startTime", "Indica la hora de inicio.");
        if (input.EndTime is { } end && input.StartTime is { } start && end < start) Add("endTime", "La hora de fin no puede ser anterior al inicio.");
        if (input.ClientId is null && input.Type is CalendarEventType.Evaluation or CalendarEventType.RestDay)
            Add("clientId", "Elige la clienta para una evaluación o un descanso.");
        return errors;
    }

    // ---------- Vista del calendario ----------

    /// <summary>
    /// Elementos del calendario entre dos fechas. Para la entrenadora: todos sus clientes o uno; para un cliente: solo lo suyo
    /// (sin eventos generales de la entrenadora ni eventos cancelados). Devuelve null si el cliente pedido no es visible.
    /// </summary>
    public async Task<List<CalendarItem>?> BuildAsync(DateOnly from, DateOnly to, int? clientId, CancellationToken ct = default)
    {
        var isClient = user.IsClient;
        if (isClient) clientId = await access.CurrentClientIdAsync(ct);
        if (clientId is { } id && !await access.VisibleClients().AnyAsync(c => c.Id == id, ct)) return null;
        if (isClient && clientId is null) return null;

        var clients = access.VisibleClients().Where(c => clientId == null || c.Id == clientId);
        var names = await clients.Select(c => new { c.Id, Name = c.FirstName + " " + c.LastName }).ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        string? NameOf(int? cid) => isClient || cid is null ? null : names.GetValueOrDefault(cid.Value);
        var clientIds = names.Keys.ToList();
        var items = new List<CalendarItem>();

        // Eventos guardados por la entrenadora.
        var userId = user.UserId;
        var events = isClient
            ? db.CalendarEvents.Where(e => e.ClientId == clientId && e.Status != CalendarEventStatus.Cancelled)
            : db.CalendarEvents.Where(e => e.TrainerId == userId && (clientId == null || e.ClientId == clientId));
        var eventRows = await events.AsNoTracking().Where(e => e.Date >= from && e.Date <= to).ToListAsync(ct);
        foreach (var e in eventRows.OrderBy(e => e.Date).ThenBy(e => e.StartTime))
            items.Add(new CalendarItem(EventKind(e.Type), e.Date, e.Title, TrackingLabels.ManualEventTypes.GetValueOrDefault(e.Type), StatusOf(e.Status),
                e.ClientId, NameOf(e.ClientId), e.Id, e.TrainingLogId, e.EvaluationId, e.StartTime, e.EndTime, e.Notes));

        // Asignaciones: inicio, fin y (para una sola clienta) días de rutina y descansos.
        var assignments = await db.RoutineAssignments.AsNoTracking()
            .Where(a => clientIds.Contains(a.ClientId) && a.Status != AssignmentStatus.Cancelled && a.StartDate <= to && (a.EndDate == null || a.EndDate >= from))
            .Include(a => a.RoutineVersion).ThenInclude(v => v.Days)
            .ToListAsync(ct);
        var today = BusinessTime.LocalDate(clock.GetUtcNow().UtcDateTime);

        var logs = await db.TrainingLogs.AsNoTracking().Where(l => clientIds.Contains(l.ClientId))
            .Where(l => l.StartedAt >= ToUtc(from.AddDays(-1)) && l.StartedAt < ToUtc(to.AddDays(2)))
            .Select(l => new { l.Id, l.ClientId, l.StartedAt, l.Status, l.DayName, l.RoutineTitle, l.RoutineDayId })
            .ToListAsync(ct);
        var sessions = logs.Select(l => new { l.Id, l.ClientId, Date = BusinessTime.LocalDate(l.StartedAt), l.Status, l.DayName, l.RoutineTitle, l.RoutineDayId })
            .Where(l => l.Date >= from && l.Date <= to).ToList();

        foreach (var a in assignments)
        {
            var title = a.RoutineVersion.Title;
            if (a.StartDate >= from && a.StartDate <= to)
                items.Add(new CalendarItem(Kinds.ProgramStart, a.StartDate, $"Inicio: {title}", null, "planned", a.ClientId, NameOf(a.ClientId), null, null, null, null, null, null));
            if (a.EndDate is { } end && end >= from && end <= to)
                items.Add(new CalendarItem(Kinds.ProgramEnd, end, $"Fin: {title}", null, "planned", a.ClientId, NameOf(a.ClientId), null, null, null, null, null, null));
        }

        if (clientId is not null)
        {
            for (var date = from; date <= to; date = date.AddDays(1))
            {
                var current = assignments.Where(a => a.StartDate <= date && (a.EndDate == null || a.EndDate >= date)).ToList();
                var planned = current.SelectMany(a => a.RoutineVersion.Days.Where(d => d.DayOfWeek == date.DayOfWeek).OrderBy(d => d.Position)
                    .Select(d => (Assignment: a, Day: d))).ToList();
                foreach (var (a, d) in planned)
                {
                    var done = sessions.Any(s => s.Date == date && s.RoutineDayId == d.Id && s.Status == TrainingLogStatus.Completed);
                    items.Add(new CalendarItem(Kinds.Planned, date, d.Name, a.RoutineVersion.Title, done ? "completed" : "planned",
                        a.ClientId, NameOf(a.ClientId), null, null, null, null, null, null));
                }
                var allScheduled = current.Count > 0 && current.All(a => a.RoutineVersion.Days.Count > 0 && a.RoutineVersion.Days.All(d => d.DayOfWeek != null));
                if (planned.Count == 0 && allScheduled && !eventRows.Any(e => e.Date == date && e.Type == CalendarEventType.RestDay && e.Status != CalendarEventStatus.Cancelled))
                    items.Add(new CalendarItem(Kinds.Rest, date, "Descanso", "Según los días de la rutina", "planned", clientId, NameOf(clientId), null, null, null, null, null, null));
            }
        }

        foreach (var s in sessions)
            items.Add(new CalendarItem(Kinds.Session, s.Date, s.DayName ?? "Entrenamiento", s.RoutineTitle,
                s.Status == TrainingLogStatus.Completed ? "completed" : "in-progress", s.ClientId, NameOf(s.ClientId), null, s.Id, null, null, null, null));

        var linked = eventRows.Where(e => e.EvaluationId != null).Select(e => e.EvaluationId!.Value).ToHashSet();
        var evaluations = await db.Evaluations.AsNoTracking()
            .Where(e => clientIds.Contains(e.ClientId) && e.EvaluatedOn >= from && e.EvaluatedOn <= to)
            .Select(e => new { e.Id, e.ClientId, e.EvaluatedOn, Count = e.Measurements.Count }).ToListAsync(ct);
        foreach (var e in evaluations.Where(e => !linked.Contains(e.Id)))
            items.Add(new CalendarItem(Kinds.Evaluation, e.EvaluatedOn, "Evaluación", $"{e.Count} {(e.Count == 1 ? "medida" : "medidas")}", "completed",
                e.ClientId, NameOf(e.ClientId), null, null, e.Id, null, null, null));

        return items.OrderBy(i => i.Date).ThenBy(i => i.StartTime ?? TimeOnly.MinValue).ThenBy(i => KindOrder(i.Kind)).ThenBy(i => i.ClientName).ToList();
    }

    private static DateTime ToUtc(DateOnly date) => TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue), BusinessTime.TimeZone);

    private static string EventKind(CalendarEventType type) => type switch
    {
        CalendarEventType.ScheduledTraining => Kinds.Training,
        CalendarEventType.RestDay => Kinds.Rest,
        CalendarEventType.Evaluation => Kinds.Evaluation,
        CalendarEventType.ProgramStart => Kinds.ProgramStart,
        CalendarEventType.ProgramEnd => Kinds.ProgramEnd,
        _ => Kinds.Other,
    };

    private static string StatusOf(CalendarEventStatus s) => s switch
    {
        CalendarEventStatus.Completed => "completed",
        CalendarEventStatus.Cancelled => "cancelled",
        _ => "planned",
    };

    private static int KindOrder(string kind) => kind switch
    {
        Kinds.ProgramStart => 0, Kinds.Planned => 1, Kinds.Training => 2, Kinds.Session => 3, Kinds.Evaluation => 4,
        Kinds.Rest => 5, Kinds.Other => 6, _ => 7,
    };

    private void Audit(string action, int id, string? details) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = user.UserId, Action = action, EntityType = nameof(CalendarEvent), EntityId = id.ToString(), Details = details
    });
}
