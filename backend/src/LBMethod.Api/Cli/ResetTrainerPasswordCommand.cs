using LBMethod.Application.Accounts;

namespace LBMethod.Api.Cli;

/// <summary>
/// Restablece la contraseña de la entrenadora desde la terminal, por si la olvidó:
///   dotnet run --project src/LBMethod.Api -- reset-trainer-password correo@dominio.com
/// La nueva contraseña se escribe de forma oculta. También reactiva y desbloquea la cuenta y cierra sus sesiones.
/// </summary>
public static class ResetTrainerPasswordCommand
{
    public const string Name = "reset-trainer-password";

    public static async Task<int> RunAsync(IServiceProvider services, string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Uso: reset-trainer-password <correo>");
            return 1;
        }

        var password = CreateTrainerCommand.ReadPassword("Nueva contraseña (mínimo 10 caracteres, con mayúscula, minúscula y número): ");
        if (password != CreateTrainerCommand.ReadPassword("Repite la contraseña: "))
        {
            Console.Error.WriteLine("Las contraseñas no coinciden.");
            return 1;
        }

        await using var scope = services.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IAccountService>();
        var result = await accounts.ResetTrainerPasswordAsync(args[1].Trim(), password);
        if (!result.Succeeded)
        {
            Console.Error.WriteLine(result.Error == AccountError.NotFound
                ? "No existe una cuenta de entrenadora con ese correo. Créala con: create-trainer <correo> \"<nombre>\""
                : "No se pudo cambiar la contraseña: " + string.Join(" ", result.Messages ?? []));
            return 1;
        }

        Console.WriteLine("Contraseña actualizada. Ya puedes iniciar sesión.");
        return 0;
    }
}
