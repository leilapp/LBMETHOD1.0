using System.Text;
using LBMethod.Application.Accounts;

namespace LBMethod.Api.Cli;

/// <summary>
/// Crea la cuenta de la entrenadora desde la terminal (no existe registro público):
///   dotnet run --project src/LBMethod.Api -- create-trainer correo@dominio.com "Nombre visible"
/// La contraseña se escribe de forma oculta; nunca se pasa como argumento ni se guarda en archivos.
/// </summary>
public static class CreateTrainerCommand
{
    public const string Name = "create-trainer";

    public static async Task<int> RunAsync(IServiceProvider services, string[] args)
    {
        if (args.Length < 3)
        {
            Console.Error.WriteLine("Uso: create-trainer <correo> \"<nombre visible>\"");
            return 1;
        }

        var password = ReadPassword("Contraseña (mínimo 10 caracteres, con mayúscula, minúscula y número): ");
        if (password != ReadPassword("Repite la contraseña: "))
        {
            Console.Error.WriteLine("Las contraseñas no coinciden.");
            return 1;
        }

        await using var scope = services.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IAccountService>();
        var result = await accounts.CreateTrainerAsync(args[1].Trim(), args[2].Trim(), password);
        if (!result.Succeeded)
        {
            Console.Error.WriteLine(result.Error == AccountError.EmailInUse
                ? "Ya existe una cuenta con ese correo."
                : "No se pudo crear la cuenta: " + string.Join(" ", result.Messages ?? []));
            return 1;
        }

        Console.WriteLine("Cuenta de entrenadora creada.");
        return 0;
    }

    private static string ReadPassword(string prompt)
    {
        Console.Write(prompt);
        if (Console.IsInputRedirected) return Console.ReadLine() ?? string.Empty;

        var sb = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace) { if (sb.Length > 0) sb.Length--; continue; }
            if (!char.IsControl(key.KeyChar)) sb.Append(key.KeyChar);
        }
        Console.WriteLine();
        return sb.ToString();
    }
}
