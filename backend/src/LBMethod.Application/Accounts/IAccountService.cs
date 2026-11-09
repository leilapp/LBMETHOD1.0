namespace LBMethod.Application.Accounts;

public enum AccountError
{
    None = 0,
    NotFound,
    EmailInUse,
    InvalidData
}

public record AccountResult(AccountError Error, IReadOnlyList<string>? Messages = null)
{
    public bool Succeeded => Error == AccountError.None;
    public static AccountResult Ok() => new(AccountError.None);
}

/// <summary>Resultado de crear una cuenta o restablecer su contraseña. La contraseña temporal se muestra una sola vez.</summary>
public record TemporaryPasswordResult(AccountError Error, int ClientId = 0, string? TemporaryPassword = null, IReadOnlyList<string>? Messages = null)
{
    public bool Succeeded => Error == AccountError.None;
}

public record NewClientAccount(string FirstName, string LastName, string Email, string? Phone);

/// <summary>
/// Operaciones de cuentas que realiza la entrenadora. Sin envío de correos (decisión de Leilani):
/// la entrenadora comparte la contraseña temporal directamente y el cliente debe cambiarla al entrar.
/// Todas las operaciones comprueban que el cliente pertenezca a la entrenadora indicada.
/// </summary>
public interface IAccountService
{
    Task<TemporaryPasswordResult> CreateClientAccountAsync(int trainerId, NewClientAccount data, CancellationToken ct = default);
    Task<TemporaryPasswordResult> ResetClientPasswordAsync(int trainerId, int clientId, CancellationToken ct = default);
    Task<AccountResult> SetClientAccessAsync(int trainerId, int clientId, bool enabled, CancellationToken ct = default);
    /// <summary>Cambia el correo (que también es el usuario para entrar) de la cuenta del cliente.</summary>
    Task<AccountResult> ChangeClientEmailAsync(int trainerId, int clientId, string email, CancellationToken ct = default);
    Task<AccountResult> CreateTrainerAsync(string email, string displayName, string password, CancellationToken ct = default);
    /// <summary>
    /// Restablece la contraseña de la entrenadora desde la terminal (si la olvidó). También la reactiva,
    /// la desbloquea y cierra sus sesiones abiertas. Devuelve NotFound si el correo no es de una entrenadora.
    /// </summary>
    Task<AccountResult> ResetTrainerPasswordAsync(string email, string password, CancellationToken ct = default);
}
