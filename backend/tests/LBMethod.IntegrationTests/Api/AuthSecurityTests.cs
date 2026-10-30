using System.Net;
using System.Net.Http.Json;
using LBMethod.Api.Contracts;

namespace LBMethod.IntegrationTests.Api;

public class AuthSecurityTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private async Task<(ApiSession Session, string Email)> TrainerSessionAsync()
    {
        var email = await api.CreateTrainerAsync();
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
        return (session, email);
    }

    private static async Task<TemporaryPasswordResponse> CreateClientAsync(ApiSession trainer)
    {
        var res = await trainer.PostAsync("/api/trainer/clients", new
        {
            firstName = "Ana", lastName = "Cliente", email = $"{TestData.Unique("cli")}@test.local"
        });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<TemporaryPasswordResponse>())!;
    }

    private async Task<string> ClientEmailAsync(int clientId)
    {
        await using var db = api.NewDbContext();
        return db.Clients.Single(c => c.Id == clientId).Email;
    }

    /// <summary>Crea un cliente, inicia su sesión y cambia la contraseña temporal.</summary>
    private async Task<(ApiSession Session, int ClientId, string Password)> ActiveClientSessionAsync(ApiSession trainer)
    {
        var created = await CreateClientAsync(trainer);
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(await ClientEmailAsync(created.ClientId), created.TemporaryPassword)).StatusCode);
        const string newPassword = "MiClaveNueva2026";
        var change = await session.PostAsync("/api/auth/change-password", new { currentPassword = created.TemporaryPassword, newPassword });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);
        await session.RefreshCsrfAsync();
        return (session, created.ClientId, newPassword);
    }

    [Theory]
    [InlineData("/api/auth/me")]
    [InlineData("/api/trainer/clients")]
    [InlineData("/api/trainer/clients/1")]
    [InlineData("/api/portal/profile")]
    public async Task Unauthenticated_requests_are_rejected(string path)
    {
        using var anon = api.NewSession();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task Unauthenticated_write_is_rejected_even_with_csrf_token()
    {
        using var anon = api.NewSession();
        var res = await anon.PostAsync("/api/trainer/clients", new { firstName = "X", lastName = "Y", email = "x@test.local" });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Trainer_can_log_in_and_manage_client_accounts()
    {
        var (trainer, email) = await TrainerSessionAsync();
        var me = await trainer.Http.GetFromJsonAsync<SessionResponse>("/api/auth/me");
        Assert.Equal("TRAINER", me!.Role);
        Assert.Equal(email, me.Email);

        var created = await CreateClientAsync(trainer);
        Assert.Equal(14, created.TemporaryPassword.Length);

        var list = await trainer.Http.GetFromJsonAsync<List<ClientSummaryResponse>>("/api/trainer/clients");
        Assert.Contains(list!, c => c.Id == created.ClientId && c.HasAccount);

        var reset = await trainer.PostAsync($"/api/trainer/clients/{created.ClientId}/reset-password");
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        var newTemp = (await reset.Content.ReadFromJsonAsync<TemporaryPasswordResponse>())!.TemporaryPassword;
        Assert.NotEqual(created.TemporaryPassword, newTemp);

        using var client = api.NewSession();
        var clientEmail = await ClientEmailAsync(created.ClientId);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.LoginAsync(clientEmail, created.TemporaryPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.LoginAsync(clientEmail, newTemp)).StatusCode);
    }

    [Fact]
    public async Task Duplicate_client_email_is_rejected()
    {
        var (trainer, _) = await TrainerSessionAsync();
        var created = await CreateClientAsync(trainer);
        var email = await ClientEmailAsync(created.ClientId);
        var res = await trainer.PostAsync("/api/trainer/clients", new { firstName = "B", lastName = "C", email = email.ToUpperInvariant() });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    [Fact]
    public async Task Invalid_input_is_rejected()
    {
        var (trainer, _) = await TrainerSessionAsync();
        var res = await trainer.PostAsync("/api/trainer/clients", new { firstName = "", lastName = "C", email = "no-es-correo" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Wrong_password_is_rejected_and_account_locks_after_repeated_failures()
    {
        var email = await api.CreateTrainerAsync();
        using var s = api.NewSession();
        var first = await s.LoginAsync(email, "Incorrecta123");
        Assert.Equal(HttpStatusCode.Unauthorized, first.StatusCode);
        // El mensaje es genérico: no revela si el correo existe.
        var unknown = await s.LoginAsync("nadie@test.local", "Incorrecta123");
        Assert.Equal((await first.Content.ReadAsStringAsync()), (await unknown.Content.ReadAsStringAsync()));

        for (var i = 0; i < 4; i++) await s.LoginAsync(email, "Incorrecta123");
        // Tras 5 intentos fallidos, ni la contraseña correcta funciona durante el bloqueo.
        Assert.Equal(HttpStatusCode.Unauthorized, (await s.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
    }

    [Fact]
    public async Task Writes_require_a_valid_csrf_token()
    {
        var email = await api.CreateTrainerAsync();
        using var s = api.NewSession();

        // Login sin token
        var noToken = await s.PostAsync("/api/auth/login", new { email, password = ApiFactory.TrainerPassword }, withCsrf: false);
        Assert.Equal(HttpStatusCode.BadRequest, noToken.StatusCode);

        // Token obtenido antes de iniciar sesión deja de servir después (queda ligado a la identidad).
        await s.RefreshCsrfAsync();
        var login = await s.PostAsync("/api/auth/login", new { email, password = ApiFactory.TrainerPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var stale = await s.PostAsync("/api/trainer/clients", new { firstName = "A", lastName = "B", email = $"{TestData.Unique("c")}@test.local" });
        Assert.Equal(HttpStatusCode.BadRequest, stale.StatusCode);

        // Operación con sesión pero sin cabecera
        var missing = await s.PostAsync("/api/trainer/clients", new { firstName = "A", lastName = "B", email = $"{TestData.Unique("c")}@test.local" }, withCsrf: false);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);

        await s.RefreshCsrfAsync();
        var ok = await s.PostAsync("/api/trainer/clients", new { firstName = "A", lastName = "B", email = $"{TestData.Unique("c")}@test.local" });
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
    }

    [Fact]
    public async Task Client_cannot_use_trainer_endpoints()
    {
        var (trainer, _) = await TrainerSessionAsync();
        var (clientA, _, _) = await ActiveClientSessionAsync(trainer);
        var clientB = await CreateClientAsync(trainer);

        Assert.Equal(HttpStatusCode.Forbidden, (await clientA.GetAsync("/api/trainer/clients")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clientA.GetAsync($"/api/trainer/clients/{clientB.ClientId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clientA.PostAsync($"/api/trainer/clients/{clientB.ClientId}/reset-password")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clientA.PostAsync($"/api/trainer/clients/{clientB.ClientId}/access", new { enabled = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clientA.PostAsync("/api/trainer/clients", new { firstName = "X", lastName = "Y", email = "z@test.local" })).StatusCode);
    }

    [Fact]
    public async Task Each_client_sees_only_their_own_profile()
    {
        var (trainer, _) = await TrainerSessionAsync();
        var (clientA, idA, _) = await ActiveClientSessionAsync(trainer);
        var (clientB, idB, _) = await ActiveClientSessionAsync(trainer);

        var profileA = await clientA.Http.GetFromJsonAsync<ClientProfileResponse>("/api/portal/profile");
        var profileB = await clientB.Http.GetFromJsonAsync<ClientProfileResponse>("/api/portal/profile");
        Assert.Equal(idA, profileA!.Id);
        Assert.Equal(idB, profileB!.Id);

        // Intentar pasar el Id de otro cliente en la URL no cambia nada: el portal no acepta Ids.
        Assert.Equal(HttpStatusCode.NotFound, (await clientA.GetAsync($"/api/portal/profile/{idB}")).StatusCode);
        Assert.Equal(idA, (await clientA.Http.GetFromJsonAsync<ClientProfileResponse>($"/api/portal/profile?clientId={idB}"))!.Id);
    }

    [Fact]
    public async Task Trainer_cannot_reach_clients_of_another_trainer()
    {
        var (trainer1, _) = await TrainerSessionAsync();
        var (trainer2, _) = await TrainerSessionAsync();
        var client = await CreateClientAsync(trainer1);

        Assert.Equal(HttpStatusCode.NotFound, (await trainer2.GetAsync($"/api/trainer/clients/{client.ClientId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await trainer2.PostAsync($"/api/trainer/clients/{client.ClientId}/reset-password")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await trainer2.PostAsync($"/api/trainer/clients/{client.ClientId}/access", new { enabled = false })).StatusCode);
        var list = await trainer2.Http.GetFromJsonAsync<List<ClientSummaryResponse>>("/api/trainer/clients");
        Assert.DoesNotContain(list!, c => c.Id == client.ClientId);
    }

    [Fact]
    public async Task Temporary_password_must_be_changed_before_using_the_portal()
    {
        var (trainer, _) = await TrainerSessionAsync();
        var created = await CreateClientAsync(trainer);
        using var client = api.NewSession();
        await client.LoginAsync(await ClientEmailAsync(created.ClientId), created.TemporaryPassword);

        var me = await client.Http.GetFromJsonAsync<SessionResponse>("/api/auth/me");
        Assert.True(me!.MustChangePassword);
        Assert.Equal(created.ClientId, me.ClientId);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/portal/profile")).StatusCode);

        var weak = await client.PostAsync("/api/auth/change-password", new { currentPassword = created.TemporaryPassword, newPassword = "corta" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);

        var change = await client.PostAsync("/api/auth/change-password", new { currentPassword = created.TemporaryPassword, newPassword = "MiClaveNueva2026" });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/portal/profile")).StatusCode);
    }

    [Fact]
    public async Task Logout_ends_the_session_and_invalidates_copies_of_the_cookie()
    {
        var email = await api.CreateTrainerAsync();
        using var trainer = api.NewSession();
        var login = await trainer.LoginAsync(email, ApiFactory.TrainerPassword);
        var sessionCookie = login.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("lb.session=")).Split(';')[0];

        // Simula una copia de la cookie de sesión (por ejemplo, robada) hecha antes del cierre de sesión.
        using var copied = api.CreateClient(new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactoryClientOptions { HandleCookies = false });
        copied.DefaultRequestHeaders.Add("Cookie", sessionCookie);
        Assert.Equal(HttpStatusCode.OK, (await copied.GetAsync("/api/auth/me")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await trainer.LogoutAsync()).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await trainer.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await copied.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Disabling_a_client_closes_open_sessions_and_blocks_login()
    {
        var (trainer, _) = await TrainerSessionAsync();
        var (client, clientId, password) = await ActiveClientSessionAsync(trainer);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/portal/profile")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await trainer.PostAsync($"/api/trainer/clients/{clientId}/access", new { enabled = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/portal/profile")).StatusCode);
        var summary = await trainer.Http.GetFromJsonAsync<ClientSummaryResponse>($"/api/trainer/clients/{clientId}");
        Assert.Equal("Inactive", summary!.Status);

        using var again = api.NewSession();
        var email = await ClientEmailAsync(clientId);
        Assert.Equal(HttpStatusCode.Unauthorized, (await again.LoginAsync(email, password)).StatusCode);

        // Reactivar devuelve el acceso; sus datos siguen intactos.
        Assert.Equal(HttpStatusCode.NoContent, (await trainer.PostAsync($"/api/trainer/clients/{clientId}/access", new { enabled = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await again.LoginAsync(email, password)).StatusCode);
    }

    [Fact]
    public async Task Logs_never_contain_passwords()
    {
        var (trainer, email) = await TrainerSessionAsync();
        using (var bad = api.NewSession()) await bad.LoginAsync(email, "ClaveEquivocada99");
        var (_, _, clientPassword) = await ActiveClientSessionAsync(trainer);
        var created = await CreateClientAsync(trainer);

        var all = string.Join("\n", api.Logs);
        Assert.NotEmpty(api.Logs);
        Assert.DoesNotContain(ApiFactory.TrainerPassword, all);
        Assert.DoesNotContain("ClaveEquivocada99", all);
        Assert.DoesNotContain(clientPassword, all);
        Assert.DoesNotContain(created.TemporaryPassword, all);
        Assert.Contains("Inicio de sesión fallido", all);
    }

    [Fact]
    public async Task Errors_do_not_expose_internal_details()
    {
        using var s = api.NewSession();
        await s.RefreshCsrfAsync();
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = new StringContent("{ esto no es json", System.Text.Encoding.UTF8, "application/json")
        };
        req.Headers.Add("X-CSRF-TOKEN", (await s.Http.GetFromJsonAsync<CsrfTokenResponse>("/api/auth/csrf"))!.Token);
        var res = await s.Http.SendAsync(req);
        var body = await res.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.DoesNotContain("Exception", body);
        Assert.DoesNotContain("System.", body);
        Assert.DoesNotContain(" at ", body);
    }

    [Fact]
    public async Task Cors_allows_only_configured_origins_and_security_headers_are_present()
    {
        using var s = api.NewSession();
        HttpRequestMessage Preflight(string origin)
        {
            var r = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
            r.Headers.Add("Origin", origin);
            r.Headers.Add("Access-Control-Request-Method", "POST");
            r.Headers.Add("Access-Control-Request-Headers", "content-type,x-csrf-token");
            return r;
        }

        var allowed = await s.Http.SendAsync(Preflight(ApiFactory.AllowedOrigin));
        Assert.Equal(ApiFactory.AllowedOrigin, allowed.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal("true", allowed.Headers.GetValues("Access-Control-Allow-Credentials").Single());

        var evil = await s.Http.SendAsync(Preflight("https://sitio-malicioso.example"));
        Assert.False(evil.Headers.Contains("Access-Control-Allow-Origin"));

        var any = await s.GetAsync("/api/auth/csrf");
        Assert.Equal("nosniff", any.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", any.Headers.GetValues("X-Frame-Options").Single());
    }

    [Fact]
    public async Task Session_cookie_is_http_only_and_strict()
    {
        var email = await api.CreateTrainerAsync();
        using var s = api.NewSession();
        await s.RefreshCsrfAsync();
        var res = await s.PostAsync("/api/auth/login", new { email, password = ApiFactory.TrainerPassword });
        var setCookie = res.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("lb.session="));
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", setCookie, StringComparison.OrdinalIgnoreCase);
    }
}
