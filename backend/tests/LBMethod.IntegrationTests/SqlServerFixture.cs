using LBMethod.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.IntegrationTests;

/// <summary>
/// Crea una base de datos temporal en un SQL Server real, aplica las migraciones y la elimina al final.
/// Requiere la variable de entorno LBMETHOD_TEST_SQL con una cadena de conexión al servidor
/// (sin base de datos), por ejemplo: "Server=localhost;Integrated Security=True;TrustServerCertificate=True".
/// Nunca apunta a la base de datos de desarrollo ni de producción.
/// </summary>
public sealed class SqlServerFixture : IAsyncLifetime
{
    public const string EnvVar = "LBMETHOD_TEST_SQL";

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        var server = Environment.GetEnvironmentVariable(EnvVar)
            ?? throw new InvalidOperationException(
                $"Define la variable de entorno {EnvVar} con la cadena de conexión a un SQL Server de pruebas.");

        var builder = new SqlConnectionStringBuilder(server)
        {
            InitialCatalog = $"LBMethod_Test_{Guid.NewGuid():N}"
        };
        ConnectionString = builder.ConnectionString;

        await using var db = CreateContext();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await using var db = CreateContext();
        await db.Database.EnsureDeletedAsync();
    }

    public LBMethodDbContext CreateContext() =>
        new(PersistenceSetup.Configure(new DbContextOptionsBuilder<LBMethodDbContext>(), ConnectionString).Options);
}

[CollectionDefinition(Name)]
public sealed class SqlServerCollection : ICollectionFixture<SqlServerFixture>
{
    public const string Name = "SQL Server";
}
