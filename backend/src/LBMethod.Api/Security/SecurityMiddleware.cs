using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;

namespace LBMethod.Api.Security;

public static class SecurityMiddleware
{
    public const string CsrfHeader = "X-CSRF-TOKEN";

    private static readonly string[] PathsAllowedWithTemporaryPassword =
        ["/api/auth/me", "/api/auth/csrf", "/api/auth/change-password", "/api/auth/logout"];

    /// <summary>Cabeceras básicas de seguridad en todas las respuestas.</summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["X-Frame-Options"] = "DENY";
        h["Referrer-Policy"] = "no-referrer";
        h["Cache-Control"] = "no-store";
        await next();
    });

    /// <summary>
    /// Protección CSRF: toda operación que modifica datos (POST, PUT, PATCH, DELETE) en /api debe incluir
    /// la cabecera X-CSRF-TOKEN obtenida de GET /api/auth/csrf. Incluye el inicio de sesión.
    /// </summary>
    public static IApplicationBuilder UseCsrfProtection(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method)
            && !HttpMethods.IsHead(ctx.Request.Method) && !HttpMethods.IsOptions(ctx.Request.Method))
        {
            var antiforgery = ctx.RequestServices.GetRequiredService<IAntiforgery>();
            try
            {
                await antiforgery.ValidateRequestAsync(ctx);
            }
            catch (AntiforgeryValidationException)
            {
                await Problem(ctx, StatusCodes.Status400BadRequest, "Solicitud no válida",
                    "Falta o no es válido el token de seguridad (CSRF). Vuelve a cargar la página.");
                return;
            }
        }
        await next();
    });

    /// <summary>Con contraseña temporal solo se permite consultar la sesión, cambiar la contraseña o salir.</summary>
    public static IApplicationBuilder UseRequirePasswordChange(this IApplicationBuilder app) => app.Use(async (ctx, next) =>
    {
        if (ctx.User.HasClaim(c => c.Type == AppClaims.MustChangePassword)
            && ctx.Request.Path.StartsWithSegments("/api")
            && !PathsAllowedWithTemporaryPassword.Any(p => ctx.Request.Path.Equals(p, StringComparison.OrdinalIgnoreCase)))
        {
            await Problem(ctx, StatusCodes.Status403Forbidden, "Cambio de contraseña requerido",
                "Debes cambiar tu contraseña temporal antes de continuar.");
            return;
        }
        await next();
    });

    private static Task Problem(HttpContext ctx, int status, string title, string detail)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new ProblemDetails { Status = status, Title = title, Detail = detail },
            options: null, contentType: "application/problem+json");
    }
}
