using LBMethod.Application.Abstractions;
using LBMethod.Application.Accounts;
using LBMethod.Application.Security;
using LBMethod.Infrastructure.Identity;
using LBMethod.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace LBMethod.Infrastructure;

public static class DependencyInjection
{
    /// <summary>Registra SQL Server, servicios de cuentas y de acceso a datos.</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddDbContext<LBMethodDbContext>((sp, options) =>
            PersistenceSetup.Configure(options, connectionString, sp.GetRequiredService<TimeProvider>()));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<LBMethodDbContext>());
        services.AddScoped<IAccountService, AccountService>();
        services.AddScoped<ClientAccess>();
        return services;
    }
}
