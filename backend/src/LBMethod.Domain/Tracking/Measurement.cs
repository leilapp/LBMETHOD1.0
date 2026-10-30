using LBMethod.Domain.Common;
using LBMethod.Domain.Files;

namespace LBMethod.Domain.Tracking;

public enum MeasurementKind
{
    /// <summary>Peso corporal (distinto de la carga de un ejercicio).</summary>
    BodyWeight = 1,
    Circumference = 2,
    BodyComposition = 3,
    Other = 99
}

public enum PhotoCategory
{
    Front = 1,
    Side = 2,
    Back = 3,
    Other = 99
}

/// <summary>Tipo de medida configurable (peso corporal, cintura, cadera…) con su unidad.</summary>
public class MeasurementType : Entity
{
    public string NameEs { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public MeasurementKind Kind { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>Evaluación de un cliente en una fecha; agrupa medidas y fotos para poder compararlas.</summary>
public class Evaluation : Entity
{
    public int ClientId { get; set; }
    public Clients.Client Client { get; set; } = null!;
    public DateOnly EvaluatedOn { get; set; }
    public int PerformedByUserId { get; set; }
    public string? Notes { get; set; }

    public ICollection<Measurement> Measurements { get; set; } = new List<Measurement>();
}

/// <summary>
/// Valor medido en una fecha. Guarda su propia unidad (copiada del tipo al registrarse)
/// para que un cambio posterior en la configuración no altere el historial.
/// </summary>
public class Measurement : Entity
{
    public int ClientId { get; set; }
    public Clients.Client Client { get; set; } = null!;
    public int MeasurementTypeId { get; set; }
    public MeasurementType MeasurementType { get; set; } = null!;
    public int? EvaluationId { get; set; }
    public Evaluation? Evaluation { get; set; }
    public DateOnly MeasuredOn { get; set; }
    public decimal Value { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int RecordedByUserId { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Foto de progreso privada: solo la ven su propietaria y la entrenadora autorizada.</summary>
public class ProgressPhoto : Entity
{
    public int ClientId { get; set; }
    public Clients.Client Client { get; set; } = null!;
    public Guid StoredFileId { get; set; }
    public StoredFile StoredFile { get; set; } = null!;
    public int? EvaluationId { get; set; }
    public Evaluation? Evaluation { get; set; }
    public DateOnly TakenOn { get; set; }
    public PhotoCategory? Category { get; set; }
    public string? Notes { get; set; }
}
