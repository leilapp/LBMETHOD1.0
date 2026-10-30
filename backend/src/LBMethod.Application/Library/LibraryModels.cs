using System.Globalization;
using System.Text;
using LBMethod.Domain.Exercises;

namespace LBMethod.Application.Library;

public enum LibraryError
{
    None = 0,
    NotFound,
    Duplicate,
    Invalid
}

/// <summary>Resultado de una operación de la biblioteca, con errores por campo cuando aplica.</summary>
public record LibraryResult(LibraryError Error, int Id = 0, IReadOnlyDictionary<string, string[]>? Errors = null)
{
    public bool Succeeded => Error == LibraryError.None;
    public static LibraryResult Ok(int id = 0) => new(LibraryError.None, id);
    public static LibraryResult NotFound() => new(LibraryError.NotFound);
    public static LibraryResult Duplicate(string field, string message) => new(LibraryError.Duplicate, Errors: One(field, message));
    public static LibraryResult Invalid(string field, string message) => new(LibraryError.Invalid, Errors: One(field, message));
    public static LibraryResult Invalid(Dictionary<string, List<string>> errors) =>
        new(LibraryError.Invalid, Errors: errors.ToDictionary(e => e.Key, e => e.Value.ToArray()));

    private static Dictionary<string, string[]> One(string field, string message) => new() { [field] = [message] };
}

/// <summary>Datos de un ejercicio tal como los decide la entrenadora (sin parámetros de rutina).</summary>
public record ExerciseInput(
    string NameEs,
    string? NameEn,
    string? Description,
    string? Instructions,
    string? CommonMistakes,
    string? TechnicalTips,
    ExerciseType Type,
    Difficulty? Difficulty,
    int? MovementPatternId,
    int PrimaryMuscleGroupId,
    IReadOnlyList<int> SecondaryMuscleGroupIds,
    IReadOnlyList<int> EquipmentIds);

public record CatalogInput(string NameEs, string NameEn, bool IsActive = true);

/// <summary>Textos en español usados en la interfaz, la plantilla de Excel y las exportaciones.</summary>
public static class LibraryLabels
{
    public static readonly IReadOnlyDictionary<ExerciseType, string> Types = new Dictionary<ExerciseType, string>
    {
        [ExerciseType.Strength] = "Fuerza",
        [ExerciseType.Mobility] = "Movilidad",
        [ExerciseType.Cardio] = "Cardio",
        [ExerciseType.Plyometric] = "Pliométrico",
        [ExerciseType.Isometric] = "Isométrico",
        [ExerciseType.Stretching] = "Estiramiento",
        [ExerciseType.Other] = "Otro",
    };

    public static readonly IReadOnlyDictionary<Difficulty, string> Difficulties = new Dictionary<Difficulty, string>
    {
        [Difficulty.Beginner] = "Principiante",
        [Difficulty.Intermediate] = "Intermedio",
        [Difficulty.Advanced] = "Avanzado",
    };

    public static ExerciseType? ParseType(string? text) => Find(Types, text);
    public static Difficulty? ParseDifficulty(string? text) => Find(Difficulties, text);

    private static T? Find<T>(IReadOnlyDictionary<T, string> map, string? text) where T : struct
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var key = NameNormalizer.Normalize(text);
        foreach (var (value, label) in map)
            if (NameNormalizer.Normalize(label) == key || NameNormalizer.Normalize(value.ToString()!) == key) return value;
        return null;
    }
}

/// <summary>
/// Normaliza nombres para compararlos igual que SQL Server con la intercalación sin mayúsculas ni acentos:
/// "  Sentadilla   Búlgara " y "sentadilla bulgara" son el mismo nombre.
/// </summary>
public static class NameNormalizer
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var decomposed = value.Trim().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        var lastWasSpace = false;
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            if (char.IsWhiteSpace(ch))
            {
                if (!lastWasSpace) sb.Append(' ');
                lastWasSpace = true;
                continue;
            }
            sb.Append(char.ToLowerInvariant(ch));
            lastWasSpace = false;
        }
        return sb.ToString();
    }

    /// <summary>Recorta y une espacios repetidos, conservando acentos y mayúsculas tal como se escribieron.</summary>
    public static string Clean(string value) => string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    public static string? CleanOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
