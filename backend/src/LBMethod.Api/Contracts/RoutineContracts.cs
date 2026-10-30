using System.ComponentModel.DataAnnotations;
using LBMethod.Domain.Common;
using LBMethod.Domain.Routines;

namespace LBMethod.Api.Contracts;

public record CreateRoutineRequest(
    [Required] RoutineKind? Kind,
    [Required, MaxLength(150)] string Title,
    [MaxLength(2000)] string? Description,
    [MaxLength(500)] string? Goal,
    int? DurationWeeks);

public record RoutineSetRequest(
    SetType SetType, int? RepsMin, int? RepsMax, decimal? SuggestedWeight, WeightUnit? SuggestedWeightUnit,
    int? RestSeconds, decimal? Rir, decimal? Rpe, string? Notes);

public record RoutineExerciseRequest(
    int ExerciseId, string? SupersetGroup, int Sets, int? RepsMin, int? RepsMax,
    decimal? SuggestedWeight, WeightUnit? SuggestedWeightUnit, int? RestSeconds, string? Tempo,
    decimal? Rir, decimal? Rpe, SetType SetType, string? Notes, RoutineSetRequest[]? SetDetails);

public record RoutineDayRequest(string? Name, DayOfWeek? DayOfWeek, string? Notes, RoutineExerciseRequest[]? Exercises);

/// <summary>Las reglas de cada campo las valida el servicio, para devolver la ruta exacta del campo (days[0].exercises[1].repsMax).</summary>
public record SaveDraftRequest(
    [Required] int? DraftVersionId,
    string? Title,
    string? Description,
    string? Goal,
    int? DurationWeeks,
    RoutineDayRequest[]? Days);

public record PublishRequest([Required] int? DraftVersionId, [MaxLength(1000)] string? ChangeNotes);

/// <summary>Copiar una versión en una rutina nueva (duplicar, guardar como plantilla o usar una plantilla).</summary>
public record CopyRoutineRequest([Required] RoutineKind? Kind, [MaxLength(150)] string? Title, int? VersionId);

public record RoutineSummaryResponse(
    int Id, string Kind, string Name, string Status, string? Goal, int? PublishedVersionNumber, bool HasDraft,
    int DayCount, int ExerciseCount, DateTime UpdatedAt);

public record RoutineVersionSummaryResponse(int Id, int VersionNumber, string Status, string Title, DateTime? PublishedAt, string? ChangeNotes, DateTime UpdatedAt);

public record RoutineDetailResponse(
    int Id, string Kind, string Name, string Status, DateTime? ArchivedAt, int? DraftVersionId, int? LatestPublishedVersionId,
    IReadOnlyList<RoutineVersionSummaryResponse> Versions);

public record RoutineSetResponse(
    int SetNumber, int SetType, string SetTypeLabel, int? RepsMin, int? RepsMax, decimal? SuggestedWeight, int? SuggestedWeightUnit,
    int? RestSeconds, decimal? Rir, decimal? Rpe, string? Notes);

public record RoutineExerciseResponse(
    int Id, int Position, int ExerciseId, string ExerciseNameEs, string? ExerciseNameEn, bool ExerciseIsActive, string? PrimaryMuscleGroup,
    string? SupersetGroup, int Sets, int? RepsMin, int? RepsMax, decimal? SuggestedWeight, int? SuggestedWeightUnit, int? RestSeconds,
    string? Tempo, decimal? Rir, decimal? Rpe, int SetType, string SetTypeLabel, string? Notes, IReadOnlyList<RoutineSetResponse> SetDetails);

public record RoutineDayResponse(int Id, int Position, string Name, int? DayOfWeek, string? DayLabel, string? Notes, IReadOnlyList<RoutineExerciseResponse> Exercises);

public record RoutineVersionResponse(
    int Id, int RoutineId, string RoutineKind, int VersionNumber, string Status, string Title, string? Description, string? Goal,
    int? DurationWeeks, string? ChangeNotes, DateTime? PublishedAt, int? SourceVersionId, DateTime UpdatedAt,
    IReadOnlyList<RoutineDayResponse> Days);

public record RoutineOptionsResponse(IReadOnlyList<OptionResponse> SetTypes, IReadOnlyList<OptionResponse> DaysOfWeek, IReadOnlyList<OptionResponse> WeightUnits);
