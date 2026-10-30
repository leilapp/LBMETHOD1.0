using LBMethod.Application.Abstractions;
using LBMethod.Domain.Exercises;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Library;

public enum ImportRowStatus
{
    Valid = 1,
    Duplicate = 2,
    Error = 3
}

public record ImportRowResult(int RowNumber, string? NameEs, string? NameEn, ImportRowStatus Status, IReadOnlyList<string> Messages);

public record ImportPreview(IReadOnlyList<ImportRowResult> Rows)
{
    public int Valid => Rows.Count(r => r.Status == ImportRowStatus.Valid);
    public int Duplicates => Rows.Count(r => r.Status == ImportRowStatus.Duplicate);
    public int Errors => Rows.Count(r => r.Status == ImportRowStatus.Error);
}

public record ImportReport(int Created, IReadOnlyList<ImportRowResult> Rejected);

/// <summary>
/// Importación del catálogo desde Excel. Primero se muestra una vista previa fila por fila; al confirmar
/// se vuelve a validar todo y solo se guardan las filas válidas, en una sola operación.
/// Nunca se crean grupos musculares, equipamiento ni patrones nuevos de forma implícita.
/// </summary>
public class ExerciseImportService(IAppDbContext db, IExerciseSpreadsheet spreadsheet, ExerciseService exercises)
{
    public const int MaxRows = 2000;

    public async Task<ImportPreview> PreviewAsync(Stream content, CancellationToken ct = default)
    {
        var rows = spreadsheet.Read(content, MaxRows);
        var (results, _) = await AnalyzeAsync(rows, ct);
        return new ImportPreview(results);
    }

    public async Task<ImportReport> CommitAsync(Stream content, CancellationToken ct = default)
    {
        var rows = spreadsheet.Read(content, MaxRows);
        return await db.InTransactionAsync(async () =>
        {
            var (results, inputs) = await AnalyzeAsync(rows, ct);
            var rejected = results.Where(r => r.Status != ImportRowStatus.Valid).ToList();
            var created = 0;
            foreach (var (rowNumber, input) in inputs)
            {
                // Se valida otra vez con las mismas reglas que el formulario (incluye duplicados en la base).
                var result = await exercises.CreateAsync(input, ct);
                if (result.Succeeded) { created++; continue; }
                var row = results.Single(r => r.RowNumber == rowNumber);
                rejected.Add(row with
                {
                    Status = result.Error == LibraryError.Duplicate ? ImportRowStatus.Duplicate : ImportRowStatus.Error,
                    Messages = result.Errors?.SelectMany(e => e.Value).ToList() ?? ["No se pudo guardar."]
                });
            }
            return new ImportReport(created, rejected.OrderBy(r => r.RowNumber).ToList());
        }, ct);
    }

    private async Task<(List<ImportRowResult> Results, List<(int Row, ExerciseInput Input)> Inputs)> AnalyzeAsync(
        IReadOnlyList<SpreadsheetRow> rows, CancellationToken ct)
    {
        var muscles = await Lookup(db.MuscleGroups, ct);
        var equipment = await Lookup(db.Equipment, ct);
        var patterns = await Lookup(db.MovementPatterns, ct);

        // Nombres ya registrados (activos o desactivados), comparados sin mayúsculas ni acentos.
        var existing = new HashSet<string>();
        foreach (var e in await db.Exercises.Select(e => new { e.NameEs, e.NameEn }).ToListAsync(ct))
        {
            existing.Add(NameNormalizer.Normalize(e.NameEs));
            if (e.NameEn is not null) existing.Add(NameNormalizer.Normalize(e.NameEn));
        }
        var inFile = new Dictionary<string, int>();

        var results = new List<ImportRowResult>();
        var inputs = new List<(int, ExerciseInput)>();
        foreach (var row in rows)
        {
            var messages = new List<string>();
            var nameEs = NameNormalizer.CleanOptional(row.NameEs);
            var nameEn = NameNormalizer.CleanOptional(row.NameEn);

            if (nameEs is null) messages.Add("Falta el nombre en español.");
            else if (nameEs.Length > 150) messages.Add("El nombre en español supera 150 caracteres.");
            if (nameEn?.Length > 150) messages.Add("El nombre en inglés supera 150 caracteres.");

            var primary = Resolve(muscles, row.PrimaryMuscleGroup, "Grupo principal", messages, required: true);
            var secondary = SplitList(row.SecondaryMuscleGroups)
                .Select(n => Resolve(muscles, n, "Músculo secundario", messages, required: true)).OfType<int>().Distinct().ToList();
            if (primary is { } p && secondary.Contains(p)) messages.Add("El grupo principal está repetido como secundario.");
            var equipmentIds = SplitList(row.Equipment)
                .Select(n => Resolve(equipment, n, "Equipamiento", messages, required: true)).OfType<int>().Distinct().ToList();
            var pattern = Resolve(patterns, row.MovementPattern, "Patrón de movimiento", messages, required: false);

            var type = LibraryLabels.ParseType(row.Type);
            if (string.IsNullOrWhiteSpace(row.Type)) messages.Add("Falta el tipo de ejercicio.");
            else if (type is null) messages.Add($"Tipo \"{row.Type!.Trim()}\" no reconocido. Usa uno de la hoja Catálogos.");
            var difficulty = LibraryLabels.ParseDifficulty(row.Difficulty);
            if (!string.IsNullOrWhiteSpace(row.Difficulty) && difficulty is null)
                messages.Add($"Dificultad \"{row.Difficulty!.Trim()}\" no reconocida. Usa uno de la hoja Catálogos.");

            foreach (var (label, max, value) in new[]
                     {
                         ("La descripción", 2000, row.Description), ("Las instrucciones", 4000, row.Instructions),
                         ("Los errores frecuentes", 2000, row.CommonMistakes), ("Los consejos técnicos", 2000, row.TechnicalTips)
                     })
                if (value?.Trim().Length > max) messages.Add($"{label} supera {max} caracteres.");

            if (messages.Count > 0)
            {
                results.Add(new ImportRowResult(row.RowNumber, nameEs, nameEn, ImportRowStatus.Error, messages));
                continue;
            }

            var keys = new[] { nameEs, nameEn }.OfType<string>().Select(NameNormalizer.Normalize).Distinct().ToList();
            if (keys.Any(existing.Contains))
            {
                results.Add(new ImportRowResult(row.RowNumber, nameEs, nameEn, ImportRowStatus.Duplicate,
                    ["Ya existe en la biblioteca un ejercicio con ese nombre (puede estar desactivado)."]));
                continue;
            }
            var repeatedIn = keys.Where(inFile.ContainsKey).Select(k => inFile[k]).FirstOrDefault();
            if (repeatedIn > 0)
            {
                results.Add(new ImportRowResult(row.RowNumber, nameEs, nameEn, ImportRowStatus.Duplicate,
                    [$"El nombre se repite en la fila {repeatedIn} del archivo."]));
                continue;
            }
            foreach (var k in keys) inFile[k] = row.RowNumber;

            results.Add(new ImportRowResult(row.RowNumber, nameEs, nameEn, ImportRowStatus.Valid, []));
            inputs.Add((row.RowNumber, new ExerciseInput(nameEs!, nameEn, row.Description, row.Instructions, row.CommonMistakes,
                row.TechnicalTips, type!.Value, difficulty, pattern, primary!.Value, secondary, equipmentIds)));
        }
        return (results, inputs);
    }

    private static async Task<Dictionary<string, (int Id, bool Active)>> Lookup<T>(IQueryable<T> set, CancellationToken ct)
        where T : class, ICatalogEntry
    {
        var map = new Dictionary<string, (int, bool)>();
        foreach (var x in await set.Select(x => new { x.Id, x.NameEs, x.NameEn, x.IsActive }).ToListAsync(ct))
        {
            map.TryAdd(NameNormalizer.Normalize(x.NameEs), (x.Id, x.IsActive));
            map.TryAdd(NameNormalizer.Normalize(x.NameEn), (x.Id, x.IsActive));
        }
        return map;
    }

    private static int? Resolve(Dictionary<string, (int Id, bool Active)> map, string? name, string label, List<string> messages, bool required)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            if (required) messages.Add($"Falta: {label}.");
            return null;
        }
        if (!map.TryGetValue(NameNormalizer.Normalize(name), out var entry))
        {
            messages.Add($"{label} \"{name.Trim()}\" no existe en el catálogo. Agrégalo primero o corrige el nombre.");
            return null;
        }
        if (!entry.Active)
        {
            messages.Add($"{label} \"{name.Trim()}\" está desactivado.");
            return null;
        }
        return entry.Id;
    }

    private static IEnumerable<string> SplitList(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(IExerciseSpreadsheet.ListSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
