using LBMethod.Api.Contracts;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Accounts;
using LBMethod.Application.Clients;
using LBMethod.Application.Security;
using LBMethod.Domain.Routines;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Trainer;

/// <summary>
/// Cuentas de clientes administradas por la entrenadora. El perfil completo, las notas privadas
/// y las asignaciones están en <see cref="ClientProfilesController"/>.
/// </summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/clients")]
public class ClientAccountsController(IAccountService accounts, ClientAccess access, AssignmentService assignments, ICurrentUser user) : ControllerBase
{
    /// <summary>Clientes de la entrenadora, con el programa que tienen vigente hoy (si lo hay).</summary>
    [HttpGet]
    public async Task<IReadOnlyList<ClientSummaryResponse>> List(CancellationToken ct)
    {
        var today = assignments.Today();
        var clients = await access.VisibleClients()
            .OrderBy(c => c.LastName).ThenBy(c => c.FirstName)
            .Select(c => new { c.Id, c.FirstName, c.LastName, c.Email, c.Status, HasAccount = c.UserId != null, c.CreatedAt })
            .ToListAsync(ct);
        var current = await assignments.Owned()
            .Where(a => a.Status != AssignmentStatus.Cancelled && a.Status != AssignmentStatus.Replaced && a.Status != AssignmentStatus.Completed
                        && a.StartDate <= today && (a.EndDate == null || a.EndDate >= today))
            .OrderByDescending(a => a.StartDate)
            .Select(a => new { a.ClientId, a.RoutineVersion.Title })
            .ToListAsync(ct);
        var programs = current.GroupBy(a => a.ClientId).ToDictionary(g => g.Key, g => string.Join(" · ", g.Select(x => x.Title)));
        return clients.Select(c => new ClientSummaryResponse(c.Id, c.FirstName, c.LastName, c.Email, c.Status.ToString(), c.HasAccount,
            programs.GetValueOrDefault(c.Id), c.CreatedAt)).ToList();
    }

    [HttpGet("{clientId:int}")]
    public async Task<ActionResult<ClientSummaryResponse>> Get(int clientId, CancellationToken ct)
    {
        var client = await access.VisibleClients().Where(c => c.Id == clientId)
            .Select(c => new ClientSummaryResponse(c.Id, c.FirstName, c.LastName, c.Email, c.Status.ToString(), c.UserId != null))
            .SingleOrDefaultAsync(ct);
        return client is null ? NotFound() : client;
    }

    /// <summary>Crea el perfil básico y la cuenta del cliente. La contraseña temporal se muestra una sola vez.</summary>
    [HttpPost]
    public async Task<ActionResult<TemporaryPasswordResponse>> Create(CreateClientAccountRequest request, CancellationToken ct)
    {
        var result = await accounts.CreateClientAccountAsync(user.UserId,
            new NewClientAccount(request.FirstName, request.LastName, request.Email, request.Phone), ct);
        return result.Error switch
        {
            AccountError.None => CreatedAtAction(nameof(Get), new { clientId = result.ClientId },
                new TemporaryPasswordResponse(result.ClientId, result.TemporaryPassword!)),
            AccountError.EmailInUse => Conflict(new ProblemDetails { Status = 409, Title = "Correo en uso", Detail = "Ya existe una cuenta con ese correo." }),
            _ => ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["account"] = result.Messages?.ToArray() ?? [] }))
        };
    }

    [HttpPost("{clientId:int}/reset-password")]
    public async Task<ActionResult<TemporaryPasswordResponse>> ResetPassword(int clientId, CancellationToken ct)
    {
        var result = await accounts.ResetClientPasswordAsync(user.UserId, clientId, ct);
        return result.Succeeded ? new TemporaryPasswordResponse(clientId, result.TemporaryPassword!) : NotFound();
    }

    /// <summary>Habilita o deshabilita el acceso del cliente. Deshabilitar cierra sus sesiones y no borra datos.</summary>
    [HttpPost("{clientId:int}/access")]
    public async Task<IActionResult> SetAccess(int clientId, SetAccessRequest request, CancellationToken ct)
    {
        var result = await accounts.SetClientAccessAsync(user.UserId, clientId, request.Enabled!.Value, ct);
        return result.Succeeded ? NoContent() : NotFound();
    }
}
