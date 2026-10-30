using LBMethod.Api.Contracts;
using LBMethod.Api.Controllers.Trainer.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Clients;
using LBMethod.Application.Security;
using LBMethod.Domain.Clients;
using LBMethod.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Trainer;

/// <summary>Perfil completo del cliente, observaciones privadas e historial de asignaciones (solo la entrenadora dueña).</summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/clients")]
public class ClientProfilesController(ClientService clients, AssignmentService assignments, ClientAccess access, IAppDbContext db) : ControllerBase
{
    [HttpGet("options")]
    public ClientOptionsResponse Options() => new(
        ClientLabels.Experience.Select(e => new OptionResponse((int)e.Key, e.Value)).ToList(),
        ClientLabels.Locations.Select(l => new OptionResponse((int)l.Key, l.Value)).ToList(),
        ClientLabels.Days.Select(d => new OptionResponse((int)d.Day, d.Label)).ToList(),
        [new((int)WeightUnit.Kg, "kg"), new((int)WeightUnit.Lb, "lb")],
        [new((int)LengthUnit.Cm, "cm"), new((int)LengthUnit.In, "in")]);

    [HttpGet("{clientId:int}/profile")]
    public async Task<ActionResult<ClientDetailResponse>> Profile(int clientId, CancellationToken ct)
    {
        var c = await access.VisibleClients().AsNoTracking().SingleOrDefaultAsync(x => x.Id == clientId, ct);
        if (c is null) return NotFound();
        return new ClientDetailResponse(c.Id, c.FirstName, c.LastName, c.Email, c.Phone, c.BirthDate,
            c.Height, (int?)c.HeightUnit, c.Weight, (int?)c.WeightUnit,
            (int?)c.ExperienceLevel, c.ExperienceLevel is { } e ? ClientLabels.Experience[e] : null, c.Goal,
            (int?)c.TrainingLocation, c.TrainingLocation is { } l ? ClientLabels.Locations[l] : null,
            (int)c.AvailableDays, ClientLabels.DayNames(c.AvailableDays), c.SessionDurationMinutes, c.DeclaredLimitations,
            c.Status.ToString(), c.UserId != null, c.CreatedAt, c.DeactivatedAt);
    }

    [HttpPut("{clientId:int}/profile")]
    public async Task<IActionResult> UpdateProfile(int clientId, UpdateClientProfileRequest r, CancellationToken ct)
    {
        var input = new ClientProfileInput(r.FirstName ?? string.Empty, r.LastName ?? string.Empty, r.Email ?? string.Empty, r.Phone, r.BirthDate,
            r.Height, (LengthUnit?)r.HeightUnit, r.Weight, (WeightUnit?)r.WeightUnit, (ExperienceLevel?)r.ExperienceLevel, r.Goal,
            (TrainingLocation?)r.TrainingLocation, (WeekDays)(r.AvailableDays ?? 0), r.SessionDurationMinutes, r.DeclaredLimitations);
        return this.ToResponse(await clients.UpdateProfileAsync(clientId, input, ct), NoContent);
    }

    [HttpGet("{clientId:int}/notes")]
    public async Task<ActionResult<IReadOnlyList<ClientNoteResponse>>> Notes(int clientId, CancellationToken ct)
    {
        if (!await access.TrainerOwnsClientAsync(clientId, ct)) return NotFound();
        return await db.ClientNotes.Where(n => n.ClientId == clientId)
            .OrderByDescending(n => n.CreatedAt).ThenByDescending(n => n.Id)
            .Select(n => new ClientNoteResponse(n.Id, n.Content, n.CreatedAt))
            .ToListAsync(ct);
    }

    [HttpPost("{clientId:int}/notes")]
    public async Task<IActionResult> AddNote(int clientId, AddClientNoteRequest r, CancellationToken ct)
    {
        var result = await clients.AddNoteAsync(clientId, r.Content, ct);
        return this.ToResponse(result, () => StatusCode(StatusCodes.Status201Created, new IdResponse(result.Id)));
    }

    [HttpGet("{clientId:int}/assignments")]
    public async Task<ActionResult<IReadOnlyList<AssignmentResponse>>> Assignments(int clientId, CancellationToken ct)
    {
        if (!await access.TrainerOwnsClientAsync(clientId, ct)) return NotFound();
        return await assignments.Owned().Where(a => a.ClientId == clientId).ToResponsesAsync(db, assignments.Today(), ct);
    }
}
