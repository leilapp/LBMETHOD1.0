namespace LBMethod.Domain.Common;

/// <summary>
/// Base de todas las entidades del dominio. Las fechas se guardan siempre en UTC;
/// CreatedAt y UpdatedAt los asigna automáticamente la capa de persistencia.
/// </summary>
public abstract class Entity
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
