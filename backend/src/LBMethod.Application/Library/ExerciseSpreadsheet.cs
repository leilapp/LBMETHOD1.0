namespace LBMethod.Application.Library;

/// <summary>Una fila de ejercicio tal como viene escrita en el archivo de Excel (texto sin interpretar).</summary>
public record SpreadsheetRow(
    int RowNumber,
    string? NameEs,
    string? NameEn,
    string? Description,
    string? PrimaryMuscleGroup,
    string? SecondaryMuscleGroups,
    string? Equipment,
    string? Type,
    string? MovementPattern,
    string? Difficulty,
    string? Instructions,
    string? CommonMistakes,
    string? TechnicalTips,
    string? Active = null);

/// <summary>Nombres válidos que se muestran en la hoja "Catálogos" de la plantilla.</summary>
public record CatalogLists(
    IReadOnlyList<string> MuscleGroups,
    IReadOnlyList<string> Equipment,
    IReadOnlyList<string> MovementPatterns,
    IReadOnlyList<string> Types,
    IReadOnlyList<string> Difficulties);

/// <summary>El archivo no se pudo leer como una plantilla de ejercicios.</summary>
public class SpreadsheetFormatException(string message) : Exception(message);

/// <summary>Lectura y escritura de archivos de Excel del catálogo (implementado en infraestructura).</summary>
public interface IExerciseSpreadsheet
{
    /// <summary>Separador para varios valores en una misma celda (músculos secundarios, equipamiento).</summary>
    const char ListSeparator = ';';

    IReadOnlyList<SpreadsheetRow> Read(Stream content, int maxRows);
    byte[] BuildTemplate(CatalogLists catalogs);
    byte[] BuildExport(IEnumerable<SpreadsheetRow> rows, CatalogLists catalogs);
}
