using LBMethod.Api.Contracts;
using LBMethod.Api.Security;
using LBMethod.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Portal;

/// <summary>Portal del cliente: siempre opera sobre el perfil de la sesión actual, sin recibir Ids.</summary>
[ApiController]
[Authorize(Policy = Policies.Client)]
[Route("api/portal")]
public class ProfileController(ClientAccess access) : ControllerBase
{
    [HttpGet("profile")]
    public async Task<ActionResult<ClientProfileResponse>> Profile(CancellationToken ct)
    {
        var profile = await access.VisibleClients()
            .Select(c => new ClientProfileResponse(c.Id, c.FirstName, c.LastName, c.Email, c.Phone, c.BirthDate, c.Goal, c.DeclaredLimitations))
            .SingleOrDefaultAsync(ct);
        return profile is null ? NotFound() : profile;
    }
}
