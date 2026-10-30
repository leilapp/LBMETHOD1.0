using LBMethod.Api.Contracts;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Infrastructure.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    SignInManager<AppUser> signIn,
    UserManager<AppUser> users,
    IAntiforgery antiforgery,
    IAppDbContext db,
    TimeProvider clock,
    ILogger<AuthController> logger) : ControllerBase
{
    private const string InvalidCredentials = "Correo o contraseña incorrectos, o la cuenta está bloqueada temporalmente.";

    /// <summary>Entrega el token CSRF que el frontend debe enviar en la cabecera X-CSRF-TOKEN. Pedirlo de nuevo tras iniciar o cerrar sesión.</summary>
    [AllowAnonymous]
    [HttpGet("csrf")]
    public CsrfTokenResponse Csrf() => new(antiforgery.GetAndStoreTokens(HttpContext).RequestToken!);

    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Login)]
    [HttpPost("login")]
    public async Task<ActionResult<SessionResponse>> Login(LoginRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            logger.LogInformation("Inicio de sesión fallido: cuenta inexistente.");
            return Unauthorized(Problem(InvalidCredentials));
        }

        var result = await signIn.PasswordSignInAsync(user, request.Password, isPersistent: false, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            logger.LogInformation("Inicio de sesión fallido para el usuario {UserId}. Bloqueado: {LockedOut}. No permitido: {NotAllowed}.",
                user.Id, result.IsLockedOut, result.IsNotAllowed);
            return Unauthorized(Problem(InvalidCredentials));
        }

        user.LastLoginAt = clock.GetUtcNow().UtcDateTime;
        await users.UpdateAsync(user);
        logger.LogInformation("Inicio de sesión correcto del usuario {UserId}.", user.Id);
        return await SessionFor(user);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        // Cambiar el sello de seguridad invalida también copias de la cookie que pudieran existir.
        var user = await users.GetUserAsync(User);
        if (user is not null) await users.UpdateSecurityStampAsync(user);
        await signIn.SignOutAsync();
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<SessionResponse>> Me()
    {
        var user = await users.GetUserAsync(User);
        if (user is null) return Unauthorized();
        return await SessionFor(user);
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await users.GetUserAsync(User);
        if (user is null) return Unauthorized();
        if (request.NewPassword == request.CurrentPassword)
            return ValidationProblem(Detail("La nueva contraseña debe ser distinta de la actual."));

        var result = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
            return ValidationProblem(Detail(string.Join(" ", result.Errors.Select(e => e.Description))));

        user.MustChangePassword = false;
        await users.UpdateAsync(user);
        await signIn.RefreshSignInAsync(user);
        logger.LogInformation("El usuario {UserId} cambió su contraseña.", user.Id);
        return NoContent();
    }

    private async Task<SessionResponse> SessionFor(AppUser user)
    {
        var roles = await users.GetRolesAsync(user);
        var role = roles.Contains(Roles.Trainer) ? Roles.Trainer : roles.FirstOrDefault() ?? string.Empty;
        int? clientId = null;
        // "user" ya fue verificado (contraseña o sesión); su perfil se busca por su propio Id, nunca por uno recibido.
        if (role == Roles.Client)
            clientId = await db.Clients.Where(c => c.UserId == user.Id).Select(c => (int?)c.Id).SingleOrDefaultAsync();
        return new SessionResponse(user.Id, user.DisplayName, user.Email!, role, user.MustChangePassword, clientId);
    }

    private static ProblemDetails Problem(string detail) =>
        new() { Status = StatusCodes.Status401Unauthorized, Title = "No autorizado", Detail = detail };

    private static ValidationProblemDetails Detail(string message) =>
        new(new Dictionary<string, string[]> { ["password"] = [message] }) { Title = "Datos no válidos" };
}
