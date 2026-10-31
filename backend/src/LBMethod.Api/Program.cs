using System.Threading.RateLimiting;
using LBMethod.Api.Cli;
using LBMethod.Api.Hosting;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Infrastructure;
using LBMethod.Infrastructure.Identity;
using LBMethod.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;
var isDevOrTest = builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Testing");

// ---------- Datos ----------
var connectionString = config.GetConnectionString(PersistenceSetup.ConnectionStringName)
    ?? throw new InvalidOperationException(
        "Falta la cadena de conexión 'ConnectionStrings:LBMethod'. Configúrala con User Secrets o variables de entorno.");
builder.Services.AddInfrastructure(connectionString);
// Los archivos privados viven fuera de cualquier carpeta pública y solo se entregan por un endpoint con permisos.
var mediaLimits = new LBMethod.Application.Library.MediaLimits(
    config.GetValue("Library:MaxImageBytes", 5L * 1024 * 1024), config.GetValue("Library:MaxVideoBytes", 100L * 1024 * 1024));
builder.Services.AddLibrary(
    config["Storage:LocalPath"] is { Length: > 0 } storagePath ? storagePath : Path.Combine(builder.Environment.ContentRootPath, "storage"),
    mediaLimits);
var trackingLimits = new LBMethod.Application.Tracking.TrackingLimits(config.GetValue("Tracking:MaxPhotoBytes", 10L * 1024 * 1024));
builder.Services.AddTracking(trackingLimits);
builder.Services.AddExports();
// El límite general de tamaño de petición se mantiene; solo la subida de medios y fotos lo amplía (MediaUploadLimit).
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(o => o.MultipartBodyLengthLimit = Math.Max(Math.Max(mediaLimits.MaxImageBytes, mediaLimits.MaxVideoBytes), trackingLimits.MaxPhotoBytes) + 1024 * 1024);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

// Llaves que firman la cookie de sesión y el token CSRF. Guardarlas en una carpeta fija evita que un reinicio
// del servidor cierre todas las sesiones (en Windows se protegen además con DPAPI de la máquina).
if (config["DataProtection:KeysPath"] is { Length: > 0 } keysPath)
{
    var dataProtection = builder.Services.AddDataProtection().SetApplicationName("LBMethod").PersistKeysToFileSystem(new DirectoryInfo(keysPath));
    if (OperatingSystem.IsWindows()) dataProtection.ProtectKeysWithDpapi(protectToLocalMachine: true);
}

// ---------- Identidad ----------
builder.Services.AddIdentityCore<AppUser>(o =>
    {
        o.Password.RequiredLength = 10;
        o.Password.RequireDigit = true;
        o.Password.RequireLowercase = true;
        o.Password.RequireUppercase = true;
        o.Password.RequireNonAlphanumeric = false;
        o.Lockout.MaxFailedAccessAttempts = config.GetValue("Security:MaxFailedLoginAttempts", 5);
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(config.GetValue("Security:LockoutMinutes", 15));
        o.Lockout.AllowedForNewUsers = true;
        o.User.RequireUniqueEmail = true;
    })
    .AddRoles<AppRole>()
    .AddEntityFrameworkStores<LBMethodDbContext>()
    .AddSignInManager<AppSignInManager>()
    .AddClaimsPrincipalFactory<AppClaimsPrincipalFactory>()
    .AddDefaultTokenProviders();

builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "lb.session";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = isDevOrTest ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = config.GetValue("Security:SessionLifetime", TimeSpan.FromHours(8));
    o.SlidingExpiration = config.GetValue("Security:SlidingExpiration", true);
    // Una API responde 401/403 en lugar de redirigir a una página de inicio de sesión.
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
});
// Revalidar la sesión con frecuencia: desactivar una cuenta o restablecer su contraseña cierra sus sesiones.
builder.Services.Configure<SecurityStampValidatorOptions>(o =>
    o.ValidationInterval = TimeSpan.FromSeconds(config.GetValue("Security:SessionRevalidationSeconds", 60)));

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.Trainer, p => p.RequireAuthenticatedUser().RequireRole(Roles.Trainer))
    .AddPolicy(Policies.Client, p => p.RequireAuthenticatedUser().RequireRole(Roles.Client))
    // Todo endpoint exige sesión salvo que se marque explícitamente [AllowAnonymous].
    .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

// ---------- Protecciones ----------
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = SecurityMiddleware.CsrfHeader;
    o.Cookie.Name = "lb.csrf";
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = isDevOrTest ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(RateLimits.Login, ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "desconocida",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = config.GetValue("Security:LoginRequestsPerMinute", 10),
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
});

var allowedOrigins = config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(allowedOrigins)
    .AllowCredentials()
    .WithHeaders("Content-Type", SecurityMiddleware.CsrfHeader)
    .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE")));

// ---------- API y errores ----------
builder.Services.AddControllers()
    .AddMvcOptions(o => o.AllowEmptyInputInBodyModelBinding = false)
    .ConfigureApiBehaviorOptions(o => o.SuppressMapClientErrors = false);
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(o => o.AllowInputFormatterExceptionMessages = false);
builder.Services.AddProblemDetails();

var app = builder.Build();

if (args.Length > 0 && args[0] == CreateTrainerCommand.Name)
    return await CreateTrainerCommand.RunAsync(app.Services, args);

// Nunca se muestran detalles internos (pila, SQL) al usuario; el detalle queda solo en el log.
app.UseExceptionHandler();
app.UseStatusCodePages();
if (!isDevOrTest)
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseSecurityHeaders();
// Build de React (carpeta con index.html). Por defecto, wwwroot junto a la API; si no existe, solo se publica la API.
var frontendServed = app.TryUseFrontend(config["Frontend:Path"] is { Length: > 0 } frontendPath ? frontendPath : Path.Combine(app.Environment.ContentRootPath, "wwwroot"));
// El enrutamiento va después de los archivos estáticos para que /assets y «/» se sirvan sin pasar por los endpoints.
app.UseRouting();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseCsrfProtection();
app.UseRequirePasswordChange();
app.UseAuthorization();
app.MapControllers();

app.Logger.LogInformation(frontendServed ? "Se sirve el frontend desde la API." : "Sin frontend compilado: solo se publica la API.");
await app.RunAsync();
return 0;

public static class RateLimits
{
    public const string Login = "login";
}

public partial class Program;
