namespace LBMethod.Api.Contracts;

/// <summary>Imagen o video autorizado para el cliente: archivo privado (por la API) o enlace externo.</summary>
public record PortalMediaResponse(int Id, string Type, string? Title, string Url, bool IsExternal);

public record PortalSetResponse(int SetNumber, string SetTypeLabel, int? RepsMin, int? RepsMax, decimal? SuggestedWeight, string? WeightUnit,
    int? RestSeconds, decimal? Rir, decimal? Rpe, string? Notes);

public record PortalExerciseResponse(
    int Id,
    int Position,
    int ExerciseId,
    string NameEs,
    string? NameEn,
    string? SupersetGroup,
    int Sets,
    int? RepsMin,
    int? RepsMax,
    decimal? SuggestedWeight,
    string? WeightUnit,
    int? RestSeconds,
    string? Tempo,
    decimal? Rir,
    decimal? Rpe,
    string SetTypeLabel,
    string? Notes,
    string? Instructions,
    string? TechnicalTips,
    IReadOnlyList<PortalSetResponse> SetDetails,
    IReadOnlyList<PortalMediaResponse> Media);

public record PortalDayResponse(int Id, int Position, string Name, string? DayLabel, string? Notes, IReadOnlyList<PortalExerciseResponse> Exercises);

/// <summary>Rutina asignada al cliente con todo su contenido, de solo lectura.</summary>
public record PortalProgramResponse(
    int AssignmentId,
    string RoutineName,
    int VersionNumber,
    string? Description,
    string? Goal,
    int? DurationWeeks,
    DateOnly StartDate,
    DateOnly? EndDate,
    string Status,
    string StatusLabel,
    string? Notes,
    IReadOnlyList<PortalDayResponse> Days);

public record NextWorkoutResponse(int AssignmentId, string RoutineName, int RoutineDayId, string DayName, string? DayLabel);

public record WeekDayResponse(DateOnly Date, string Label, IReadOnlyList<string> Planned, IReadOnlyList<SessionSummaryResponse> Sessions);

public record SessionSummaryResponse(
    int Id,
    string? RoutineTitle,
    int? VersionNumber,
    string? DayName,
    string Status,
    DateTime StartedAt,
    DateTime? CompletedAt,
    int ExercisesCompleted,
    int ExercisesTotal,
    int SetsCompleted);

public record PortalHomeResponse(
    SessionSummaryResponse? InProgress,
    IReadOnlyList<NextWorkoutResponse> Next,
    IReadOnlyList<WeekDayResponse> Week,
    SessionSummaryResponse? Last);

public record LoggedSetResponse(
    int SetNumber,
    string SetTypeLabel,
    bool IsPrescribed,
    int? PrescribedRepsMin,
    int? PrescribedRepsMax,
    decimal? PrescribedWeight,
    string? PrescribedWeightUnit,
    int? PrescribedRestSeconds,
    decimal? PrescribedRir,
    decimal? PrescribedRpe,
    string? PrescribedNotes,
    int? Reps,
    decimal? Weight,
    int? WeightUnit,
    decimal? Rir,
    decimal? Rpe,
    bool IsCompleted,
    string? Notes);

public record LoggedExerciseResponse(
    int Id,
    int Position,
    int ExerciseId,
    string NameEs,
    string? NameEn,
    string? SupersetGroup,
    int? PrescribedSets,
    int? PrescribedRepsMin,
    int? PrescribedRepsMax,
    decimal? PrescribedWeight,
    string? PrescribedWeightUnit,
    int? PrescribedRestSeconds,
    string? PrescribedTempo,
    decimal? PrescribedRir,
    decimal? PrescribedRpe,
    string? PrescribedNotes,
    bool IsCompleted,
    string? Comment,
    IReadOnlyList<LoggedSetResponse> Sets,
    IReadOnlyList<PortalMediaResponse> Media);

public record SessionDetailResponse(
    int Id,
    int? AssignmentId,
    string? RoutineTitle,
    int? VersionNumber,
    string? DayName,
    string Status,
    DateTime StartedAt,
    DateTime? CompletedAt,
    string? Comment,
    IReadOnlyList<LoggedExerciseResponse> Exercises);

public record StartSessionRequest(int? AssignmentId, int? RoutineDayId);

// Sin anotaciones: el servicio valida y devuelve los errores con la ruta exacta de cada campo.
public record LoggedSetRequest(int SetNumber, int? Reps, decimal? Weight, int? WeightUnit, decimal? Rir, decimal? Rpe, bool IsCompleted, string? Notes);

public record LoggedExerciseRequest(int Id, bool IsCompleted, string? Comment, LoggedSetRequest[]? Sets);

public record SaveSessionRequest(string? Comment, LoggedExerciseRequest[]? Exercises);
