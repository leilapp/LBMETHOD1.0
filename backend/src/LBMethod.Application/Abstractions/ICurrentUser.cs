namespace LBMethod.Application.Abstractions;

/// <summary>
/// Identidad del usuario que hace la solicitud, obtenida de la sesión validada en el servidor.
/// Nunca se toma de datos enviados por el navegador.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    int UserId { get; }
    bool IsTrainer { get; }
    bool IsClient { get; }
}
