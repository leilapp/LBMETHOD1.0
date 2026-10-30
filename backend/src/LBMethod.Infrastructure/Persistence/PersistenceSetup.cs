using LBMethod.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace LBMethod.Infrastructure.Persistence;

public static class PersistenceSetup
{
    /// <summary>Nombre de la cadena de conexión en configuración (ConnectionStrings:LBMethod).</summary>
    public const string ConnectionStringName = "LBMethod";

    /// <summary>Variable de entorno equivalente, útil para herramientas y pruebas.</summary>
    public const string ConnectionStringEnvVar = "ConnectionStrings__LBMethod";

    public static DbContextOptionsBuilder<LBMethodDbContext> Configure(
        DbContextOptionsBuilder<LBMethodDbContext> options, string connectionString, TimeProvider? clock = null)
    {
        return options
            .UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsAssembly(typeof(LBMethodDbContext).Assembly.FullName);
                sql.EnableRetryOnFailure(3);
            })
            .AddInterceptors(
                new AuditTimestampsInterceptor(clock ?? TimeProvider.System),
                new PublishedVersionGuardInterceptor());
    }
}

/// <summary>
/// Permite a "dotnet ef" crear el contexto sin la API. La cadena de conexión se toma de la
/// variable de entorno ConnectionStrings__LBMethod; nunca se guarda en el repositorio.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<LBMethodDbContext>
{
    public LBMethodDbContext CreateDbContext(string[] args)
    {
        // Para generar migraciones o scripts no se necesita conexión real; para aplicarlas sí.
        var connectionString = Environment.GetEnvironmentVariable(PersistenceSetup.ConnectionStringEnvVar)
            ?? "Server=(localdb)\\mssqllocaldb;Database=LBMethod_Design;Trusted_Connection=True;TrustServerCertificate=True";
        var options = PersistenceSetup.Configure(new DbContextOptionsBuilder<LBMethodDbContext>(), connectionString);
        return new LBMethodDbContext(options.Options);
    }
}
