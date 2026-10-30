using LBMethod.Application.Abstractions;
using LBMethod.Application.Accounts;
using LBMethod.Application.Library;
using LBMethod.Application.Security;
using LBMethod.Infrastructure.Files;
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
        services.AddScoped<Application.Routines.RoutineService>();
        return services;
    }

    /// <summary>Biblioteca de ejercicios: servicios, almacenamiento privado de archivos y Excel.</summary>
    public static IServiceCollection AddLibrary(this IServiceCollection services, string storagePath, MediaLimits limits)
    {
        services.AddSingleton<IFileStorage>(new LocalFileStorage(storagePath));
        services.AddSingleton(limits);
        services.AddSingleton<IExerciseSpreadsheet, ClosedXmlExerciseSpreadsheet>();
        services.AddScoped<ExerciseService>();
        services.AddScoped<CatalogService>();
        services.AddScoped<MediaService>();
        services.AddScoped<ExerciseImportService>();
        return services;
    }
}
