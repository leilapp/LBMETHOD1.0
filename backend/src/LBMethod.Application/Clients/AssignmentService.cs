using LBMethod.Application.Abstractions;
using LBMethod.Application.Library;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Clients;
using LBMethod.Domain.Common;
using LBMethod.Domain.Routines;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Clients;

public record AssignmentResult(LibraryResult Result, IReadOnlyList<int> Ids)
{
    public static AssignmentResult Fail(LibraryResult result) => new(result, []);
}

/// <summary>
/// Asigna versiones publicadas de rutinas a clientes. Cada asignación apunta a una versión concreta,
/// así que varios clientes comparten la misma definición de ejercicios sin copiarla.
/// Las asignaciones nunca se borran: se terminan o se cancelan y quedan como historial.
/// </summary>
public class AssignmentService(IAppDbContext db, ICurrentUser user, TimeProvider clock)
{
    public DateOnly Today() => BusinessTime.LocalDate(clock.GetUtcNow().UtcDateTime);

    /// <summary>Asignaciones de los clientes de la entrenadora actual.</summary>
    public IQueryable<RoutineAssignment> Owned()
    {
        var userId = user.UserId;
        return db.RoutineAssignments.Where(a => a.Client.TrainerId == userId);
    }

    public async Task<AssignmentResult> AssignAsync(AssignmentInput input, CancellationToken ct = default)
    {
        var errors = new Dictionary<string, List<string>>();
        void Add(string field, string message) => (errors.TryGetValue(field, out var l) ? l : errors[field] = []).Add(message);

        var clientIds = (input.ClientIds ?? []).Distinct().ToList();
        if (clientIds.Count == 0) Add("clientIds", "Elige al menos un cliente.");
        if (clientIds.Count > ClientLimits.MaxClientsPerAssignment) Add("clientIds", $"Máximo {ClientLimits.MaxClientsPerAssignment} clientes a la vez.");
        if (input.StartDate.Year < 2000) Add("startDate", "Fecha de inicio no válida.");
        if (input.EndDate is { } end && end < input.StartDate) Add("endDate", "La fecha de fin no puede ser anterior al inicio.");
        if (input.Notes is { Length: > ClientLimits.MaxAssignmentNotes }) Add("notes", $"Máximo {ClientLimits.MaxAssignmentNotes} caracteres.");
        if (errors.Count > 0) return AssignmentResult.Fail(LibraryResult.Invalid(errors));

        var userId = user.UserId;
        var version = await db.RoutineVersions.Include(v => v.Routine)
            .SingleOrDefaultAsync(v => v.Id == input.RoutineVersionId && v.Routine.TrainerId == userId, ct);
        if (version is null) return AssignmentResult.Fail(LibraryResult.NotFound());
        if (version.Status != RoutineVersionStatus.Published)
            return AssignmentResult.Fail(LibraryResult.Invalid("routineVersionId", "Solo se puede asignar una versión publicada."));
        if (version.Routine.Kind != RoutineKind.Program)
            return AssignmentResult.Fail(LibraryResult.Invalid("routineVersionId", "Una plantilla no se asigna: primero crea una rutina a partir de ella."));
        if (version.Routine.Status == RoutineStatus.Archived)
            return AssignmentResult.Fail(LibraryResult.Invalid("routineVersionId", "La rutina está archivada. Restáurala para asignarla."));

        var clients = await db.Clients.Where(c => c.TrainerId == userId && clientIds.Contains(c.Id)).ToListAsync(ct);
        if (clients.Count != clientIds.Count) return AssignmentResult.Fail(LibraryResult.NotFound());
        var inactive = clients.Where(c => c.Status != ClientStatus.Active).Select(c => $"{c.FirstName} {c.LastName}").ToList();
        if (inactive.Count > 0)
            return AssignmentResult.Fail(LibraryResult.Invalid("clientIds", $"Cliente inactivo: {string.Join(", ", inactive)}. Reactívalo para asignarle una rutina."));

        var today = Today();
        return await db.InTransactionAsync(async () =>
        {
            var created = new List<RoutineAssignment>();
            foreach (var client in clients.OrderBy(c => clientIds.IndexOf(c.Id)))
            {
                var assignment = new RoutineAssignment
                {
                    ClientId = client.Id, RoutineVersionId = version.Id, AssignedByUserId = userId,
                    StartDate = input.StartDate, EndDate = input.EndDate,
                    Status = input.StartDate > today ? AssignmentStatus.Scheduled : AssignmentStatus.Active,
                    StatusChangedAt = clock.GetUtcNow().UtcDateTime,
                    Notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim()
                };
                db.RoutineAssignments.Add(assignment);
                created.Add(assignment);
            }
            await db.SaveChangesAsync(ct);
            foreach (var a in created) Audit("AssignmentCreated", a.Id, $"cliente {a.ClientId}, versión {version.Id}");
            await db.SaveChangesAsync(ct);
            return new AssignmentResult(LibraryResult.Ok(created.Count), created.Select(a => a.Id).ToList());
        }, ct);
    }

    /// <summary>
    /// Fija el último día de una asignación. Si ese día ya llegó, la asignación queda terminada.
    /// Sirve para terminar un programa o para extenderlo/acortarlo. No borra nada.
    /// </summary>
    public async Task<LibraryResult> SetEndDateAsync(int assignmentId, DateOnly endDate, CancellationToken ct = default)
    {
        var a = await Owned().SingleOrDefaultAsync(x => x.Id == assignmentId, ct);
        if (a is null) return LibraryResult.NotFound();
        var today = Today();
        var effective = AssignmentState.Effective(a.Status, a.StartDate, a.EndDate, today);
        if (effective is AssignmentStatus.Cancelled or AssignmentStatus.Replaced)
            return LibraryResult.Conflict("Esta asignación ya no está vigente; queda solo como historial.");
        if (endDate < a.StartDate) return LibraryResult.Invalid("endDate", "La fecha de fin no puede ser anterior al inicio.");

        a.EndDate = endDate;
        a.Status = endDate <= today ? AssignmentStatus.Completed : (a.StartDate > today ? AssignmentStatus.Scheduled : AssignmentStatus.Active);
        a.StatusChangedAt = clock.GetUtcNow().UtcDateTime;
        Audit("AssignmentEndDateSet", a.Id, endDate.ToString("yyyy-MM-dd"));
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(a.Id);
    }

    /// <summary>Cancela una asignación que aún no empieza (por ejemplo, asignada por error). Queda en el historial.</summary>
    public async Task<LibraryResult> CancelAsync(int assignmentId, CancellationToken ct = default)
    {
        var a = await Owned().SingleOrDefaultAsync(x => x.Id == assignmentId, ct);
        if (a is null) return LibraryResult.NotFound();
        if (AssignmentState.Effective(a.Status, a.StartDate, a.EndDate, Today()) != AssignmentStatus.Scheduled)
            return LibraryResult.Conflict("Solo se cancela una asignación que aún no empieza. Para una vigente, termínala.");

        a.Status = AssignmentStatus.Cancelled;
        a.StatusChangedAt = clock.GetUtcNow().UtcDateTime;
        Audit("AssignmentCancelled", a.Id, null);
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(a.Id);
    }

    private void Audit(string action, int assignmentId, string? details) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = user.UserId, Action = action,
        EntityType = nameof(RoutineAssignment), EntityId = assignmentId.ToString(), Details = details
    });
}
