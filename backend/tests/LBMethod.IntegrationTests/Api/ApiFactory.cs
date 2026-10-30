using System.Collections.Concurrent;
using System.Net.Http.Json;
using LBMethod.Application.Accounts;
using LBMethod.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace LBMethod.IntegrationTests.Api;

/// <summary>
/// Levanta la API completa en memoria contra una base de datos temporal propia en SQL Server real.
/// Captura todos los mensajes de log para comprobar que no contienen secretos.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string TrainerPassword = "Entrena2026Segura";
    public const string AllowedOrigin = "http://localhost:5173";

    private readonly Dictionary<string, string> _settings;
    public string ConnectionString { get; }
    public ConcurrentQueue<string> Logs { get; } = new();

    public ApiFactory() : this(new Dictionary<string, string>()) { }

    internal ApiFactory(Dictionary<string, string> overrides)
    {
        var server = Environment.GetEnvironmentVariable(SqlServerFixture.EnvVar)
            ?? throw new InvalidOperationException($"Define la variable de entorno {SqlServerFixture.EnvVar}.");
        ConnectionString = new SqlConnectionStringBuilder(server) { InitialCatalog = $"LBMethod_ApiTest_{Guid.NewGuid():N}" }.ConnectionString;

        _settings = new Dictionary<string, string>
        {
            ["ConnectionStrings:LBMethod"] = ConnectionString,
            ["Security:SessionRevalidationSeconds"] = "0",
            ["Security:LoginRequestsPerMinute"] = "1000",
            ["Cors:AllowedOrigins:0"] = AllowedOrigin
        };
        foreach (var (k, v) in overrides) _settings[k] = v;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        foreach (var (k, v) in _settings) builder.UseSetting(k, v);
        builder.ConfigureLogging(l =>
        {
            l.SetMinimumLevel(LogLevel.Trace);
            l.AddProvider(new CapturingLoggerProvider(Logs));
        });
    }

    public async Task InitializeAsync()
    {
        await using var db = NewDbContext();
        await db.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await using (var db = NewDbContext()) await db.Database.EnsureDeletedAsync();
        await base.DisposeAsync();
    }

    public LBMethodDbContext NewDbContext() =>
        new(PersistenceSetup.Configure(new DbContextOptionsBuilder<LBMethodDbContext>(), ConnectionString).Options);

    public async Task<string> CreateTrainerAsync()
    {
        var email = $"{TestData.Unique("trainer")}@test.local";
        await using var scope = Services.CreateAsyncScope();
        var result = await scope.ServiceProvider.GetRequiredService<IAccountService>()
            .CreateTrainerAsync(email, "Entrenadora", TrainerPassword);
        Assert.True(result.Succeeded);
        return email;
    }

    public ApiSession NewSession() => new(CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false }));

    private sealed class CapturingLoggerProvider(ConcurrentQueue<string> sink) : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => new CapturingLogger(sink);
        public void Dispose() { }
    }

    private sealed class CapturingLogger(ConcurrentQueue<string> sink) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => sink.Enqueue(formatter(state, exception) + " " + exception);
    }
}

/// <summary>Cliente HTTP que se comporta como el frontend: guarda cookies y envía el token CSRF.</summary>
public sealed class ApiSession(HttpClient http) : IDisposable
{
    public HttpClient Http { get; } = http;
    private string? _csrf;

    public async Task RefreshCsrfAsync()
    {
        var res = await Http.GetFromJsonAsync<LBMethod.Api.Contracts.CsrfTokenResponse>("/api/auth/csrf");
        _csrf = res!.Token;
    }

    public async Task<HttpResponseMessage> PostAsync(string path, object? body = null, bool withCsrf = true)
    {
        if (withCsrf && _csrf is null) await RefreshCsrfAsync();
        using var req = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body ?? new { }) };
        if (withCsrf) req.Headers.Add("X-CSRF-TOKEN", _csrf);
        return await Http.SendAsync(req);
    }

    public Task<HttpResponseMessage> GetAsync(string path) => Http.GetAsync(path);

    /// <summary>Inicia sesión y renueva el token CSRF (queda ligado a la nueva identidad).</summary>
    public async Task<HttpResponseMessage> LoginAsync(string email, string password)
    {
        await RefreshCsrfAsync();
        var res = await PostAsync("/api/auth/login", new { email, password });
        if (res.IsSuccessStatusCode) await RefreshCsrfAsync();
        return res;
    }

    public async Task<HttpResponseMessage> LogoutAsync()
    {
        var res = await PostAsync("/api/auth/logout");
        _csrf = null;
        return res;
    }

    public void Dispose() => Http.Dispose();
}
