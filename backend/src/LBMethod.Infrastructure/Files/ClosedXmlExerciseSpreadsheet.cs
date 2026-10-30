using ClosedXML.Excel;
using LBMethod.Application.Library;

namespace LBMethod.Infrastructure.Files;

/// <summary>Plantilla, lectura y exportación del catálogo en formato Excel (.xlsx).</summary>
public class ClosedXmlExerciseSpreadsheet : IExerciseSpreadsheet
{
    private const string ExercisesSheet = "Ejercicios";
    private const string CatalogsSheet = "Catálogos";
    private const string HelpSheet = "Instrucciones";

    // Encabezado, si es obligatorio y nota de ayuda. El orden define las columnas.
    private static readonly (string Header, bool Required, string Help)[] Columns =
    [
        ("NombreES", true, "Nombre en español. No puede repetirse."),
        ("NombreEN", false, "Nombre en inglés (opcional). No puede repetirse."),
        ("Descripcion", false, "Descripción breve."),
        ("GrupoPrincipal", true, "Un grupo muscular de la hoja Catálogos."),
        ("MusculosSecundarios", false, "Varios grupos de la hoja Catálogos separados por punto y coma (;)."),
        ("Equipamiento", false, "Uno o varios de la hoja Catálogos separados por punto y coma (;)."),
        ("Tipo", true, "Un tipo de la hoja Catálogos."),
        ("PatronMovimiento", false, "Un patrón de la hoja Catálogos (opcional)."),
        ("Dificultad", false, "Principiante, Intermedio o Avanzado (opcional)."),
        ("Instrucciones", false, "Pasos de ejecución."),
        ("ErroresFrecuentes", false, "Errores comunes."),
        ("Consejos", false, "Consejos técnicos."),
    ];
    private const string ActiveHeader = "Activo";

    public IReadOnlyList<SpreadsheetRow> Read(Stream content, int maxRows)
    {
        XLWorkbook workbook;
        try { workbook = new XLWorkbook(content); }
        catch (Exception) { throw new SpreadsheetFormatException("El archivo no es un Excel válido (.xlsx)."); }

        using (workbook)
        {
            var sheet = workbook.Worksheets.FirstOrDefault(w => w.Name.Equals(ExercisesSheet, StringComparison.OrdinalIgnoreCase))
                        ?? workbook.Worksheets.First();
            var headerRow = sheet.Row(1);
            var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var cell in headerRow.CellsUsed())
                map.TryAdd(NameNormalizer.Normalize(cell.GetString()).Replace(" ", "").TrimEnd('*'), cell.Address.ColumnNumber);

            var missing = Columns.Where(c => c.Required && !map.ContainsKey(Key(c.Header))).Select(c => c.Header).ToList();
            if (missing.Count > 0)
                throw new SpreadsheetFormatException($"Faltan columnas obligatorias: {string.Join(", ", missing)}. Usa la plantilla descargable.");

            string? Get(IXLRow row, string header) =>
                map.TryGetValue(Key(header), out var col) && row.Cell(col).GetString() is { } v && !string.IsNullOrWhiteSpace(v) ? v.Trim() : null;

            var rows = new List<SpreadsheetRow>();
            var last = sheet.LastRowUsed()?.RowNumber() ?? 1;
            for (var r = 2; r <= last; r++)
            {
                var row = sheet.Row(r);
                if (row.CellsUsed().All(c => string.IsNullOrWhiteSpace(c.GetString()))) continue;
                if (rows.Count >= maxRows)
                    throw new SpreadsheetFormatException($"El archivo tiene más de {maxRows} filas. Divídelo en varios archivos.");
                rows.Add(new SpreadsheetRow(r,
                    Get(row, "NombreES"), Get(row, "NombreEN"), Get(row, "Descripcion"), Get(row, "GrupoPrincipal"),
                    Get(row, "MusculosSecundarios"), Get(row, "Equipamiento"), Get(row, "Tipo"), Get(row, "PatronMovimiento"),
                    Get(row, "Dificultad"), Get(row, "Instrucciones"), Get(row, "ErroresFrecuentes"), Get(row, "Consejos"),
                    Get(row, ActiveHeader)));
            }
            if (rows.Count == 0) throw new SpreadsheetFormatException("El archivo no tiene ejercicios a partir de la fila 2.");
            return rows;
        }
    }

    public byte[] BuildTemplate(CatalogLists catalogs)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet(ExercisesSheet);
        WriteHeader(sheet, includeActive: false);
        var catalogSheet = WriteCatalogs(workbook, catalogs);
        AddDropDown(sheet, "GrupoPrincipal", catalogSheet, 1, catalogs.MuscleGroups.Count);
        AddDropDown(sheet, "Tipo", catalogSheet, 4, catalogs.Types.Count);
        AddDropDown(sheet, "PatronMovimiento", catalogSheet, 3, catalogs.MovementPatterns.Count);
        AddDropDown(sheet, "Dificultad", catalogSheet, 5, catalogs.Difficulties.Count);
        WriteHelp(workbook);
        sheet.Columns().AdjustToContents(1, 1, 12, 45);
        return Save(workbook);
    }

    public byte[] BuildExport(IEnumerable<SpreadsheetRow> rows, CatalogLists catalogs)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet(ExercisesSheet);
        WriteHeader(sheet, includeActive: true);
        var r = 2;
        foreach (var row in rows)
        {
            string?[] values =
            [
                row.NameEs, row.NameEn, row.Description, row.PrimaryMuscleGroup, row.SecondaryMuscleGroups, row.Equipment,
                row.Type, row.MovementPattern, row.Difficulty, row.Instructions, row.CommonMistakes, row.TechnicalTips, row.Active
            ];
            for (var c = 0; c < values.Length; c++)
                // Se escribe como texto para que Excel no interprete fórmulas ni fechas.
                sheet.Cell(r, c + 1).SetValue(values[c] ?? string.Empty);
            r++;
        }
        WriteCatalogs(workbook, catalogs);
        sheet.Columns().AdjustToContents(1, Math.Min(r, 200), 12, 45);
        return Save(workbook);
    }

    private static string Key(string header) => NameNormalizer.Normalize(header);

    private static void WriteHeader(IXLWorksheet sheet, bool includeActive)
    {
        for (var c = 0; c < Columns.Length; c++)
        {
            var cell = sheet.Cell(1, c + 1);
            cell.SetValue(Columns[c].Header);
            cell.CreateComment().AddText(Columns[c].Help);
            if (Columns[c].Required) cell.Style.Font.FontColor = XLColor.FromHtml("#9F1D35");
        }
        if (includeActive) sheet.Cell(1, Columns.Length + 1).SetValue(ActiveHeader);
        var header = sheet.Row(1);
        header.Style.Font.Bold = true;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#F3E8EC");
        sheet.SheetView.FreezeRows(1);
    }

    private static IXLWorksheet WriteCatalogs(XLWorkbook workbook, CatalogLists catalogs)
    {
        var sheet = workbook.AddWorksheet(CatalogsSheet);
        var lists = new[]
        {
            ("Grupos musculares", catalogs.MuscleGroups), ("Equipamiento", catalogs.Equipment),
            ("Patrones de movimiento", catalogs.MovementPatterns), ("Tipos", catalogs.Types), ("Dificultad", catalogs.Difficulties)
        };
        for (var c = 0; c < lists.Length; c++)
        {
            sheet.Cell(1, c + 1).SetValue(lists[c].Item1);
            for (var i = 0; i < lists[c].Item2.Count; i++) sheet.Cell(i + 2, c + 1).SetValue(lists[c].Item2[i]);
        }
        sheet.Row(1).Style.Font.Bold = true;
        sheet.Columns().AdjustToContents();
        return sheet;
    }

    private static void AddDropDown(IXLWorksheet sheet, string header, IXLWorksheet catalogs, int catalogColumn, int count)
    {
        if (count == 0) return;
        var col = Array.FindIndex(Columns, c => c.Header == header) + 1;
        var source = catalogs.Range(2, catalogColumn, count + 1, catalogColumn);
        var validation = sheet.Range(2, col, 2001, col).CreateDataValidation();
        validation.List(source, true);
        validation.IgnoreBlanks = true;
        validation.ShowErrorMessage = false; // la validación real la hace el sistema al importar
    }

    private static void WriteHelp(XLWorkbook workbook)
    {
        var sheet = workbook.AddWorksheet(HelpSheet);
        string[] lines =
        [
            "Cómo llenar la plantilla de ejercicios",
            "1. Escribe un ejercicio por fila en la hoja Ejercicios, a partir de la fila 2. No cambies los encabezados.",
            "2. Las columnas en rojo son obligatorias: NombreES, GrupoPrincipal y Tipo.",
            "3. Los grupos musculares, el equipamiento y los patrones deben existir en la hoja Catálogos (puedes agregarlos antes en la biblioteca).",
            "4. Para varios valores en una celda, sepáralos con punto y coma. Ejemplo: Glúteos; Isquiotibiales",
            "5. Los nombres no pueden repetirse (no importan mayúsculas ni acentos). Las filas repetidas se rechazan y aparecen en el reporte.",
            "6. Las imágenes y videos se agregan después, desde la ficha de cada ejercicio.",
        ];
        for (var i = 0; i < lines.Length; i++) sheet.Cell(i + 1, 1).SetValue(lines[i]);
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Column(1).Width = 120;
    }

    private static byte[] Save(XLWorkbook workbook)
    {
        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }
}
