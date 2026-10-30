using System.Security.Claims;
using LBMethod.Application.Abstractions;
using LBMethod.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace LBMethod.Api.Security;

public static class AppClaims
{
    /// <summary>Presente mientras la cuenta tenga una contraseña temporal pendiente de cambiar.</summary>
    public const string MustChangePassword = "lb:must_change_password";
}

public static class Policies
{
    public const string Trainer = "Trainer";
    public const string Client = "Client";
}

/// <summary>Usuario actual a partir de la sesión autenticada (cookie validada por el servidor).</summary>
public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public int UserId => int.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
        ? id
        : throw new InvalidOperationException("No hay un usuario autenticado.");

    public bool IsTrainer => Principal?.IsInRole(Roles.Trainer) == true;
    public bool IsClient => Principal?.IsInRole(Roles.Client) == true;
}

/// <summary>Una cuenta desactivada por la entrenadora no puede iniciar sesión.</summary>
public class AppSignInManager(
    UserManager<AppUser> userManager,
    IHttpContextAccessor contextAccessor,
    IUserClaimsPrincipalFactory<AppUser> claimsFactory,
    IOptions<IdentityOptions> optionsAccessor,
    ILogger<SignInManager<AppUser>> logger,
    IAuthenticationSchemeProvider schemes,
    IUserConfirmation<AppUser> confirmation)
    : SignInManager<AppUser>(userManager, contextAccessor, claimsFactory, optionsAccessor, logger, schemes, confirmation)
{
    public override async Task<bool> CanSignInAsync(AppUser user) => user.IsActive && await base.CanSignInAsync(user);
}

/// <summary>Agrega a la sesión la marca de contraseña temporal pendiente.</summary>
public class AppClaimsPrincipalFactory(
    UserManager<AppUser> userManager, RoleManager<AppRole> roleManager, IOptions<IdentityOptions> options)
    : UserClaimsPrincipalFactory<AppUser, AppRole>(userManager, roleManager, options)
{
    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(AppUser user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        if (user.MustChangePassword) identity.AddClaim(new Claim(AppClaims.MustChangePassword, "true"));
        return identity;
    }
}
