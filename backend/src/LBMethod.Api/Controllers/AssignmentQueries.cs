using LBMethod.Api.Contracts;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Clients;
using LBMethod.Domain.Routines;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers;

/// <summary>Lectura de asignaciones con su estado real del día (zona horaria del negocio).</summary>
public static class AssignmentQueries
{
    public static async Task<List<AssignmentResponse>> ToResponsesAsync(this IQueryable<RoutineAssignment> query, IAppDbContext db, DateOnly today, CancellationToken ct)
    {
        var rows = await query
            .Select(a => new
            {
                a.Id, a.ClientId, a.Client.FirstName, a.Client.LastName,
                a.RoutineVersion.RoutineId, a.RoutineVersion.Title, a.RoutineVersionId, a.RoutineVersion.VersionNumber,
                Latest = db.RoutineVersions
                    .Where(v => v.RoutineId == a.RoutineVersion.RoutineId && v.Status == RoutineVersionStatus.Published)
                    .OrderByDescending(v => v.VersionNumber)
                    .Select(v => new { v.Id, v.VersionNumber })
                    .FirstOrDefault(),
                a.StartDate, a.EndDate, a.Status, a.Notes, a.CreatedAt
            })
            .ToListAsync(ct);

        return rows
            .Select(r =>
            {
                var status = AssignmentState.Effective(r.Status, r.StartDate, r.EndDate, today);
                return new AssignmentResponse(r.Id, r.ClientId, $"{r.FirstName} {r.LastName}", r.RoutineId, r.Title, r.RoutineVersionId,
                    r.VersionNumber, r.Latest?.VersionNumber, r.Latest?.Id, r.StartDate, r.EndDate, status.ToString(),
                    ClientLabels.Statuses[status], r.Notes, r.CreatedAt);
            })
            // Primero lo actual (vigente y programado), luego el historial; dentro de cada grupo, lo más reciente primero.
            .OrderBy(r => r.Status is nameof(AssignmentStatus.Active) ? 0 : r.Status is nameof(AssignmentStatus.Scheduled) ? 1 : 2)
            .ThenByDescending(r => r.StartDate)
            .ThenByDescending(r => r.Id)
            .ToList();
    }
}
