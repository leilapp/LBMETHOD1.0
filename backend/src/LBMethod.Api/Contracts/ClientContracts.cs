namespace LBMethod.Api.Contracts;

/// <summary>Perfil completo para la entrenadora. Las observaciones privadas se consultan aparte y nunca llegan al cliente.</summary>
public record ClientDetailResponse(
    int Id,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    DateOnly? BirthDate,
    decimal? Height,
    int? HeightUnit,
    decimal? Weight,
    int? WeightUnit,
    int? ExperienceLevel,
    string? ExperienceLabel,
    string? Goal,
    int? TrainingLocation,
    string? TrainingLocationLabel,
    int AvailableDays,
    IReadOnlyList<string> AvailableDayNames,
    int? SessionDurationMinutes,
    string? DeclaredLimitations,
    string Status,
    bool HasAccount,
    DateTime RegisteredAt,
    DateTime? DeactivatedAt);

// Sin anotaciones: el servicio valida y devuelve los errores con el nombre exacto de cada campo.
public record UpdateClientProfileRequest(
    string? FirstName,
    string? LastName,
    string? Email,
    string? Phone,
    DateOnly? BirthDate,
    decimal? Height,
    int? HeightUnit,
    decimal? Weight,
    int? WeightUnit,
    int? ExperienceLevel,
    string? Goal,
    int? TrainingLocation,
    int? AvailableDays,
    int? SessionDurationMinutes,
    string? DeclaredLimitations);

public record ClientNoteResponse(int Id, string Content, DateTime CreatedAt);

public record AddClientNoteRequest(string? Content);

public record ClientOptionsResponse(
    IReadOnlyList<OptionResponse> ExperienceLevels,
    IReadOnlyList<OptionResponse> TrainingLocations,
    IReadOnlyList<OptionResponse> Days,
    IReadOnlyList<OptionResponse> WeightUnits,
    IReadOnlyList<OptionResponse> LengthUnits);

public record AssignmentResponse(
    int Id,
    int ClientId,
    string ClientName,
    int RoutineId,
    string RoutineName,
    int RoutineVersionId,
    int VersionNumber,
    int? LatestVersionNumber,
    int? LatestVersionId,
    DateOnly StartDate,
    DateOnly? EndDate,
    string Status,
    string StatusLabel,
    string? Notes,
    DateTime CreatedAt);

public record CreateAssignmentRequest(int[]? ClientIds, int? RoutineVersionId, DateOnly? StartDate, DateOnly? EndDate, string? Notes);

public record AssignmentCreatedResponse(IReadOnlyList<int> Ids);

public record SetEndDateRequest(DateOnly? EndDate);

/// <summary>Asignación vista por el propio cliente: sin datos de otros clientes ni notas internas.</summary>
public record PortalAssignmentResponse(
    int Id,
    string RoutineName,
    int VersionNumber,
    DateOnly StartDate,
    DateOnly? EndDate,
    string Status,
    string StatusLabel,
    string? Notes);
