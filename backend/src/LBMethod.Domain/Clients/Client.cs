using LBMethod.Domain.Common;

namespace LBMethod.Domain.Clients;

public enum ClientStatus
{
    Active = 1,
    Inactive = 2
}

public enum ExperienceLevel
{
    Beginner = 1,
    Intermediate = 2,
    Advanced = 3
}

public enum TrainingLocation
{
    Gym = 1,
    Home = 2,
    Outdoor = 3,
    Mixed = 4
}

/// <summary>
/// Perfil de un cliente. Pertenece a una entrenadora (TrainerId) y, cuando tiene cuenta,
/// se enlaza con su usuario de Identity (UserId). Desactivar no borra su historial.
/// </summary>
public class Client : Entity
{
    public int TrainerId { get; set; }
    public int? UserId { get; set; }

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateOnly? BirthDate { get; set; }

    public decimal? Height { get; set; }
    public LengthUnit? HeightUnit { get; set; }
    public decimal? Weight { get; set; }
    public WeightUnit? WeightUnit { get; set; }

    public ExperienceLevel? ExperienceLevel { get; set; }
    public string? Goal { get; set; }
    public TrainingLocation? TrainingLocation { get; set; }
    public WeekDays AvailableDays { get; set; }
    public int? SessionDurationMinutes { get; set; }

    /// <summary>Limitaciones declaradas por el cliente (lesiones, condiciones). Visible para el cliente.</summary>
    public string? DeclaredLimitations { get; set; }

    public ClientStatus Status { get; set; } = ClientStatus.Active;
    public DateTime? DeactivatedAt { get; set; }

    public ICollection<ClientNote> PrivateNotes { get; set; } = new List<ClientNote>();
}

/// <summary>Observación privada de la entrenadora. Nunca se expone al CLIENT.</summary>
public class ClientNote : Entity
{
    public int ClientId { get; set; }
    public Client Client { get; set; } = null!;
    public int AuthorUserId { get; set; }
    public string Content { get; set; } = string.Empty;
}
