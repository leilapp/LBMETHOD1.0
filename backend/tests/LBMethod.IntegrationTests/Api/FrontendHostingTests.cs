using System.Net;

namespace LBMethod.IntegrationTests.Api;

/// <summary>Factoría con un build de React de prueba, para comprobar cómo la API sirve el frontend en producción.</summary>
public class FrontendApiFactory : ApiFactory
{
    public static readonly string FrontendPath = CreateBuild();

    public FrontendApiFactory() : base(new Dictionary<string, string> { ["Frontend:Path"] = FrontendPath }) { }

    private static string CreateBuild()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"lbmethod-test-frontend-{Guid.NewGuid():N}");
        Directory.CreateDirectory(Path.Combine(dir, "assets"));
        File.WriteAllText(Path.Combine(dir, "index.html"), "<!doctype html><title>LB METHOD</title><div id=\"root\"></div>");
        File.WriteAllText(Path.Combine(dir, "assets", "app-abc123.js"), "console.log('lb')");
        return dir;
    }
}

public class FrontendHostingTests(FrontendApiFactory api) : IClassFixture<FrontendApiFactory>
{
    [Theory]
    [InlineData("/")]
    [InlineData("/iniciar-sesion")]
    [InlineData("/entrenadora/clientes/5/seguimiento")]
    [InlineData("/portal/progreso")]
    public async Task App_routes_return_the_frontend_without_session(string path)
    {
        using var anon = api.NewSession();
        var res = await anon.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("text/html", res.Content.Headers.ContentType!.MediaType);
        Assert.Contains("<div id=\"root\">", await res.Content.ReadAsStringAsync());
        var csp = string.Join(";", res.Headers.GetValues("Content-Security-Policy"));
        Assert.Contains("script-src 'self'", csp);
        Assert.Contains("frame-ancestors 'none'", csp);
    }

    [Fact]
    public async Task Hashed_assets_are_cacheable_but_api_stays_protected_and_never_falls_back_to_html()
    {
        using var anon = api.NewSession();
        var asset = await anon.GetAsync("/assets/app-abc123.js");
        Assert.Equal(HttpStatusCode.OK, asset.StatusCode);
        Assert.Contains("immutable", asset.Headers.CacheControl!.ToString());

        // Sin sesión, cualquier ruta de /api (exista o no) pide iniciar sesión y nunca devuelve la página.
        foreach (var path in new[] { "/api", "/api/no-existe", "/api/trainer/clients" })
        {
            var res = await anon.GetAsync(path);
            Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
            Assert.NotEqual("text/html", res.Content.Headers.ContentType?.MediaType);
        }

        // Con sesión, una ruta de /api que no existe es 404, no index.html.
        using var trainer = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await trainer.LoginAsync(await api.CreateTrainerAsync(), ApiFactory.TrainerPassword)).StatusCode);
        var unknownApi = await trainer.GetAsync("/api/no-existe");
        Assert.Equal(HttpStatusCode.NotFound, unknownApi.StatusCode);
        Assert.NotEqual("text/html", unknownApi.Content.Headers.ContentType?.MediaType);
    }
}
