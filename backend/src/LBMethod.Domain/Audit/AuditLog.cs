namespace LBMethod.Domain.Audit;

/// <summary>
/// Bitácora de acciones relevantes (publicar rutina, asignar, desactivar cliente, eliminar archivo…).
/// Solo se agregan registros; nunca se editan ni eliminan. No debe contener contraseñas ni tokens.
/// </summary>
public class AuditLog
{
    public long Id { get; set; }
    public DateTime OccurredAt { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}
