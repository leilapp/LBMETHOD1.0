namespace LBMethod.Application.Exports;

/// <summary>
/// Una hoja de Excel: encabezados y filas. Los valores se escriben con su tipo (texto, número o fecha);
/// el texto nunca se interpreta como fórmula.
/// </summary>
public record ExportSheet(string Name, IReadOnlyList<string> Headers, IReadOnlyList<object?[]> Rows);

/// <summary>Genera libros de Excel (.xlsx) a partir de hojas (implementado en infraestructura).</summary>
public interface ITableExporter
{
    byte[] Build(IReadOnlyList<ExportSheet> sheets);
}

/// <summary>Archivo listo para descargar.</summary>
public record ExportFile(byte[] Content, string ContentType, string FileName);

/// <summary>Todo lo que se imprime en el PDF de una rutina, ya con textos y unidades en español.</summary>
public record RoutineDocument(
    string Title,
    int VersionNumber,
    bool IsDraft,
    string? Description,
    string? Goal,
    int? DurationWeeks,
    string? ClientName,
    DateOnly? StartDate,
    DateOnly? EndDate,
    string? AssignmentStatus,
    string? AssignmentNotes,
    DateTime GeneratedAtLocal,
    IReadOnlyList<RoutineDocumentDay> Days);

public record RoutineDocumentDay(int Position, string Name, string? DayOfWeek, string? Notes, IReadOnlyList<RoutineDocumentExercise> Exercises);

public record RoutineDocumentExercise(
    int Position,
    string Name,
    string? NameEn,
    string? Superset,
    int Sets,
    string? Reps,
    string? Weight,
    string? Rest,
    string? Tempo,
    string? Effort,
    string SetType,
    string? Notes,
    IReadOnlyList<RoutineDocumentSet> SetDetails);

public record RoutineDocumentSet(int SetNumber, string SetType, string? Reps, string? Weight, string? Rest, string? Effort, string? Notes);

/// <summary>Dibuja el PDF de una rutina con la identidad de LB METHOD (implementado en infraestructura).</summary>
public interface IRoutinePdfRenderer
{
    byte[] Render(RoutineDocument document);
}
