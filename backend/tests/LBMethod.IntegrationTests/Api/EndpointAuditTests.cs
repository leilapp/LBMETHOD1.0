using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using LBMethod.Api.Contracts;
using LBMethod.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace LBMethod.IntegrationTests.Api;

/// <summary>
/// Auditoría de autorización de la Fase 10: recorre TODOS los endpoints registrados en la API (no una lista escrita a mano),
/// así un endpoint nuevo sin protección hace fallar la prueba.
/// </summary>
public partial class EndpointAuditTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    // Los únicos endpoints públicos: obtener el token CSRF e iniciar sesión.
    private static readonly HashSet<string> Anonymous = ["GET api/auth/csrf", "POST api/auth/login"];

    private List<(string Method, string Pattern, EndpointMetadataCollection Metadata)> Endpoints() =>
        api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"])
                .Select(m => (m, e.RoutePattern.RawText!.TrimStart('/'), e.Metadata)))
            .ToList();

    /// <summary>Cambia cada parámetro de ruta por un id que no existe, para pedir la ruta real.</summary>
    private static string Concrete(string pattern) => "/" + RouteParameter().Replace(pattern, "999999");

    [GeneratedRegex(@"\{[^}]+\}")]
    private static partial Regex RouteParameter();

    [Fact]
    public void Every_endpoint_declares_the_role_that_can_use_it()
    {
        var endpoints = Endpoints();
        Assert.True(endpoints.Count > 80, $"Se esperaban todos los endpoints y se encontraron {endpoints.Count}.");
        foreach (var (method, pattern, metadata) in endpoints)
        {
            var key = $"{method} {pattern}";
            var anonymous = metadata.GetMetadata<IAllowAnonymous>() is not null;
            var policies = metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy).ToList();
            if (Anonymous.Contains(key)) { Assert.True(anonymous, key); continue; }
            Assert.False(anonymous, $"{key} no debería ser público.");
            if (pattern.StartsWith("api/trainer/")) Assert.True(policies.Contains(Policies.Trainer), $"{key} debe exigir el rol TRAINER.");
            else if (pattern.StartsWith("api/portal/")) Assert.True(policies.Contains(Policies.Client), $"{key} debe exigir el rol CLIENT.");
            else Assert.StartsWith("api/auth/", pattern); // el resto son de la propia sesión y quedan bajo la política general (sesión obligatoria)
        }
    }

    [Fact]
    public async Task Every_protected_endpoint_rejects_requests_without_session()
    {
        using var anon = api.NewSession();
        await anon.RefreshCsrfAsync(); // con token CSRF válido, para que el rechazo sea por falta de sesión
        foreach (var (method, pattern, _) in Endpoints().Where(e => !Anonymous.Contains($"{e.Method} {e.Pattern}")))
        {
            var res = await Send(anon, method, Concrete(pattern));
            Assert.True(res.StatusCode == HttpStatusCode.Unauthorized, $"{method} {pattern} respondió {(int)res.StatusCode} sin sesión.");
        }
    }

    [Fact]
    public async Task Each_role_is_rejected_on_the_other_roles_endpoints()
    {
        var email = await api.CreateTrainerAsync();
        using var trainer = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await trainer.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
        var created = (await (await trainer.PostAsync("/api/trainer/clients", new { firstName = "Rol", lastName = "Cliente", email = $"{TestData.Unique("rol")}@test.local" }))
            .Content.ReadFromJsonAsync<TemporaryPasswordResponse>())!;
        string clientEmail;
        await using (var db = api.NewDbContext()) clientEmail = db.Clients.Single(c => c.Id == created.ClientId).Email;
        using var client = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await client.LoginAsync(clientEmail, created.TemporaryPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/change-password", new { currentPassword = created.TemporaryPassword, newPassword = "MiClaveNueva2026" })).StatusCode);
        await client.RefreshCsrfAsync();

        foreach (var (method, pattern, _) in Endpoints())
        {
            if (pattern.StartsWith("api/trainer/"))
            {
                var res = await Send(client, method, Concrete(pattern));
                Assert.True(res.StatusCode == HttpStatusCode.Forbidden, $"Un cliente recibió {(int)res.StatusCode} en {method} {pattern}.");
            }
            else if (pattern.StartsWith("api/portal/"))
            {
                var res = await Send(trainer, method, Concrete(pattern));
                Assert.True(res.StatusCode == HttpStatusCode.Forbidden, $"La entrenadora recibió {(int)res.StatusCode} en {method} {pattern}.");
            }
        }
    }

    private static Task<HttpResponseMessage> Send(ApiSession session, string method, string path) => method switch
    {
        "GET" => session.GetAsync(path),
        "POST" => session.PostAsync(path, new { }),
        "PUT" => session.PutAsync(path, new { }),
        "DELETE" => session.DeleteAsync(path),
        _ => throw new InvalidOperationException($"Método no contemplado: {method}"),
    };
}
