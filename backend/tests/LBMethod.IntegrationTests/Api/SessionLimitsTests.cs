using System.Net;

namespace LBMethod.IntegrationTests.Api;

/// <summary>Pruebas que necesitan una configuración especial de la API (cada una con su propia base temporal).</summary>
public class SessionLimitsTests
{
    [Fact]
    public async Task Session_expires_after_its_lifetime()
    {
        await using var api = new ApiFactory(new()
        {
            ["Security:SessionLifetime"] = "00:00:02",
            ["Security:SlidingExpiration"] = "false"
        });
        await api.InitializeAsync();
        var email = await api.CreateTrainerAsync();
        using var s = api.NewSession();
        await s.LoginAsync(email, ApiFactory.TrainerPassword);
        Assert.Equal(HttpStatusCode.OK, (await s.GetAsync("/api/auth/me")).StatusCode);

        await Task.Delay(TimeSpan.FromSeconds(3));
        Assert.Equal(HttpStatusCode.Unauthorized, (await s.GetAsync("/api/auth/me")).StatusCode);
        await api.DisposeAsync();
    }

    [Fact]
    public async Task Login_requests_are_rate_limited()
    {
        await using var api = new ApiFactory(new() { ["Security:LoginRequestsPerMinute"] = "3" });
        await api.InitializeAsync();
        using var s = api.NewSession();
        await s.RefreshCsrfAsync();

        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++)
            codes.Add((await s.PostAsync("/api/auth/login", new { email = "nadie@test.local", password = "Incorrecta123" })).StatusCode);

        Assert.Equal([HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests], codes);
        await api.DisposeAsync();
    }
}
