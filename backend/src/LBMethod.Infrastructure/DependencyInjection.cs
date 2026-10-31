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
        services.AddScoped<Application.Clients.ClientService>();
        services.AddScoped<Application.Clients.AssignmentService>();
        services.AddScoped<Application.Training.TrainingService>();
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

    /// <summary>Seguimiento: medidas, evaluaciones, fotos de progreso privadas, progreso y calendario.</summary>
    public static IServiceCollection AddTracking(this IServiceCollection services, Application.Tracking.TrackingLimits limits)
    {
        services.AddSingleton(limits);
        services.AddScoped<Application.Tracking.TrackingService>();
        services.AddScoped<Application.Tracking.ProgressService>();
        services.AddScoped<Application.Tracking.CalendarService>();
        return services;
    }

    /// <summary>PDF de rutinas y exportaciones a Excel.</summary>
    public static IServiceCollection AddExports(this IServiceCollection services)
    {
        services.AddSingleton<Application.Exports.ITableExporter, ClosedXmlTableExporter>();
        services.AddSingleton<Application.Exports.IRoutinePdfRenderer, MigraDocRoutinePdf>();
        services.AddScoped<Application.Exports.ExportService>();
        return services;
    }
}
