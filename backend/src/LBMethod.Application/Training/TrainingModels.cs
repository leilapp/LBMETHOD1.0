using LBMethod.Domain.Common;

namespace LBMethod.Application.Training;

/// <summary>Lo que el cliente realizó en una serie. Todo es opcional mientras la sesión está en curso.</summary>
public record LoggedSetInput(int SetNumber, int? Reps, decimal? Weight, WeightUnit? WeightUnit, decimal? Rir, decimal? Rpe, bool IsCompleted, string? Notes);

public record LoggedExerciseInput(int Id, bool IsCompleted, string? Comment, IReadOnlyList<LoggedSetInput> Sets);

/// <summary>Avance de una sesión en curso: se guarda completo cada vez (es idempotente, sin duplicar).</summary>
public record SessionProgressInput(string? Comment, IReadOnlyList<LoggedExerciseInput> Exercises);

public static class TrainingLimits
{
    public const int MaxReps = 1000;
    public const decimal MaxWeight = 2000;
    public const int MaxExtraSets = 20;
    public const int MaxSessionComment = 2000;
    public const int MaxExerciseComment = 1000;
    public const int MaxSetNotes = 500;
}
