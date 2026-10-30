namespace LBMethod.Api.Contracts;

// Sin anotaciones: los servicios validan y devuelven los errores con la ruta exacta de cada campo.
public record MeasurementTypeRequest(string? NameEs, string? NameEn, int? Kind, string? Unit, bool? IsActive);

public record MeasurementTypeResponse(int Id, string NameEs, string NameEn, int Kind, string KindLabel, string Unit, int SortOrder, bool IsActive, int MeasurementCount);

public record KindOptionResponse(int Value, string Label, IReadOnlyList<string> Units);

public record TrackingOptionsResponse(IReadOnlyList<KindOptionResponse> Kinds, IReadOnlyList<OptionResponse> PhotoCategories, IReadOnlyList<OptionResponse> EventTypes);

public record MeasurementRequest(int MeasurementTypeId, decimal? Value, string? Notes);

public record EvaluationRequest(DateOnly? EvaluatedOn, string? Notes, MeasurementRequest[]? Measurements);

public record CorrectMeasurementRequest(decimal? Value, string? Notes);

public record MeasurementResponse(int Id, int MeasurementTypeId, string Name, string Kind, decimal Value, string Unit, string? Notes);

public record PhotoResponse(int Id, DateOnly TakenOn, int? Category, string? CategoryLabel, int? EvaluationId, string? Notes, string Url);

public record EvaluationResponse(int Id, DateOnly EvaluatedOn, string? Notes, DateTime CreatedAt, IReadOnlyList<MeasurementResponse> Measurements, IReadOnlyList<PhotoResponse> Photos);

/// <summary>Resumen de seguimiento de cada cliente para la entrenadora.</summary>
public record TrackingClientResponse(
    int ClientId,
    string Name,
    string Status,
    string? CurrentProgram,
    DateOnly? LastEvaluation,
    DateOnly? NextEvaluation,
    DateTime? LastSession,
    int SessionsLast30Days,
    int SessionsInProgress);

public record CalendarEventRequest(int? ClientId, int? Type, string? Title, DateOnly? Date, TimeOnly? StartTime, TimeOnly? EndTime, string? Notes);

public record EventStatusRequest(int? Status);

public record UpcomingEvaluationResponse(int EventId, int ClientId, string ClientName, DateOnly Date, TimeOnly? StartTime, string Title);

public record ActivityResponse(string Kind, int ClientId, string ClientName, DateTime OccurredAt, string Title, string? Detail, int? SessionId, int? EvaluationId);

/// <summary>Datos del inicio de la entrenadora que dependen del seguimiento.</summary>
public record TrainerDashboardResponse(IReadOnlyList<UpcomingEvaluationResponse> UpcomingEvaluations, IReadOnlyList<ActivityResponse> RecentActivity);
