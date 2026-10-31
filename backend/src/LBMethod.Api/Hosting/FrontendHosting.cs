using Microsoft.Extensions.FileProviders;

namespace LBMethod.Api.Hosting;

/// <summary>
/// En producción la API sirve también el build de React (mismo dominio), como se aprobó en la Fase 1:
/// así la cookie de sesión SameSite=Strict y la protección CSRF funcionan sin CORS.
/// Las rutas de la aplicación (por ejemplo /entrenadora/clientes) devuelven index.html; las de /api nunca.
/// </summary>
public static class FrontendHosting
{
    public static bool TryUseFrontend(this WebApplication app, string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(Path.Combine(path, "index.html"))) return false;
        var files = new PhysicalFileProvider(Path.GetFullPath(path));
        app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files }); // «/» → index.html
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = files,
            // Los archivos de /assets llevan un hash en el nombre: se pueden guardar en caché sin riesgo de quedar viejos.
            OnPrepareResponse = ctx =>
            {
                if (ctx.Context.Request.Path.StartsWithSegments("/assets"))
                    ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            }
        });
        app.MapFallbackToFile("{*path:regex(^(?!api(/|$)).*$)}", "index.html", new StaticFileOptions { FileProvider = files })
            .AllowAnonymous(); // la pantalla de inicio de sesión debe cargarse sin sesión; los datos siguen protegidos en /api
        return true;
    }
}
