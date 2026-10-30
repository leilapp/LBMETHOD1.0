using System.ComponentModel.DataAnnotations;
using LBMethod.Domain.Exercises;

namespace LBMethod.Api.Contracts;

public record CatalogItemRequest(
    [Required, MaxLength(100)] string NameEs,
    [Required, MaxLength(100)] string NameEn,
    bool IsActive = true);

public record CatalogItemResponse(int Id, string NameEs, string NameEn, bool IsActive, int ExerciseCount);

public record OptionResponse(int Value, string Label);

/// <summary>Todo lo necesario para llenar los selectores del formulario y los filtros.</summary>
public record LibraryCatalogsResponse(
    IReadOnlyList<CatalogItemResponse> MuscleGroups,
    IReadOnlyList<CatalogItemResponse> Equipment,
    IReadOnlyList<CatalogItemResponse> MovementPatterns,
    IReadOnlyList<OptionResponse> Types,
    IReadOnlyList<OptionResponse> Difficulties);

public record ExerciseRequest(
    [Required, MaxLength(150)] string NameEs,
    [MaxLength(150)] string? NameEn,
    [MaxLength(2000)] string? Description,
    [MaxLength(4000)] string? Instructions,
    [MaxLength(2000)] string? CommonMistakes,
    [MaxLength(2000)] string? TechnicalTips,
    [Required] ExerciseType? Type,
    Difficulty? Difficulty,
    int? MovementPatternId,
    [Required] int? PrimaryMuscleGroupId,
    int[]? SecondaryMuscleGroupIds,
    int[]? EquipmentIds);

public record SetActiveRequest([Required] bool? Active);

public record AddVariantRequest([Required] int? VariantExerciseId, [MaxLength(500)] string? Note);

public record AddMediaLinkRequest([Required, MaxLength(1000)] string Url, [Required] MediaType? MediaType, [MaxLength(150)] string? Title);

public record IdResponse(int Id);

public record NamedRef(int Id, string NameEs, string NameEn);

public record ExerciseListItemResponse(
    int Id, string NameEs, string? NameEn, int Type, string TypeLabel, string? PrimaryMuscleGroup,
    IReadOnlyList<string> Equipment, string? MovementPattern, bool IsActive, bool IsFavorite, int? ThumbnailMediaId);

public record PagedResponse<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public record ExerciseMediaResponse(int Id, string MediaType, string? Title, string? ExternalUrl, string? ContentUrl, string? FileName, long? SizeBytes);

public record ExerciseVariantResponse(int ExerciseId, string NameEs, string? NameEn, bool IsActive, string? Note);

public record ExerciseDetailResponse(
    int Id, string NameEs, string? NameEn, string? Description, string? Instructions, string? CommonMistakes, string? TechnicalTips,
    int Type, string TypeLabel, int? Difficulty, string? DifficultyLabel, NamedRef? MovementPattern,
    NamedRef? PrimaryMuscleGroup, IReadOnlyList<NamedRef> SecondaryMuscleGroups, IReadOnlyList<NamedRef> Equipment,
    bool IsActive, DateTime? DeactivatedAt, bool IsFavorite,
    IReadOnlyList<ExerciseVariantResponse> Variants, IReadOnlyList<ExerciseMediaResponse> Media);
