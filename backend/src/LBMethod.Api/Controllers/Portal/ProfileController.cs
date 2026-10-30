using LBMethod.Api.Contracts;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Clients;
using LBMethod.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Portal;

/// <summary>Portal del cliente: siempre opera sobre el perfil de la sesión actual, sin recibir Ids.</summary>
[ApiController]
[Authorize(Policy = Policies.Client)]
[Route("api/portal")]
public class ProfileController(ClientAccess access, AssignmentService assignments, IAppDbContext db) : ControllerBase
{
    [HttpGet("profile")]
    public async Task<ActionResult<ClientProfileResponse>> Profile(CancellationToken ct)
    {
        var c = await access.VisibleClients().AsNoTracking().SingleOrDefaultAsync(ct);
        if (c is null) return NotFound();
        // Nunca incluye las observaciones privadas de la entrenadora.
        return new ClientProfileResponse(c.Id, c.FirstName, c.LastName, c.Email, c.Phone, c.BirthDate, c.Goal, c.DeclaredLimitations,
            c.Height, c.HeightUnit?.ToString().ToLowerInvariant(), c.Weight, c.WeightUnit?.ToString().ToLowerInvariant(),
            c.ExperienceLevel is { } e ? ClientLabels.Experience[e] : null,
            c.TrainingLocation is { } l ? ClientLabels.Locations[l] : null,
            ClientLabels.DayNames(c.AvailableDays), c.SessionDurationMinutes, c.CreatedAt);
    }

    /// <summary>Asignaciones del propio cliente: la actual y las anteriores.</summary>
    [HttpGet("assignments")]
    public async Task<ActionResult<IReadOnlyList<PortalAssignmentResponse>>> Assignments(CancellationToken ct)
    {
        var clientId = await access.CurrentClientIdAsync(ct);
        if (clientId is null) return NotFound();
        var all = await db.RoutineAssignments.Where(a => a.ClientId == clientId).ToResponsesAsync(db, assignments.Today(), ct);
        return all.Select(a => new PortalAssignmentResponse(a.Id, a.RoutineName, a.VersionNumber, a.StartDate, a.EndDate, a.Status, a.StatusLabel, a.Notes))
            .Where(a => a.Status != "Cancelled")
            .ToList();
    }
}
