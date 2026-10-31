using ClosedXML.Excel;
using LBMethod.Application.Exports;

namespace LBMethod.Infrastructure.Files;

/// <summary>Exportaciones genéricas a Excel: encabezado fijo, fechas como fecha y números como número.</summary>
public class ClosedXmlTableExporter : ITableExporter
{
    public byte[] Build(IReadOnlyList<ExportSheet> sheets)
    {
        using var workbook = new XLWorkbook();
        foreach (var data in sheets)
        {
            var sheet = workbook.AddWorksheet(data.Name);
            for (var c = 0; c < data.Headers.Count; c++) sheet.Cell(1, c + 1).SetValue(data.Headers[c]);
            var header = sheet.Row(1);
            header.Style.Font.Bold = true;
            header.Style.Font.FontColor = XLColor.White;
            header.Style.Fill.BackgroundColor = XLColor.FromHtml("#3B2566");
            sheet.SheetView.FreezeRows(1);

            for (var r = 0; r < data.Rows.Count; r++)
            for (var c = 0; c < data.Rows[r].Length; c++)
            {
                var cell = sheet.Cell(r + 2, c + 1);
                switch (data.Rows[r][c])
                {
                    case null: break;
                    case DateOnly d:
                        cell.SetValue(d.ToDateTime(TimeOnly.MinValue));
                        cell.Style.DateFormat.Format = "dd/mm/yyyy";
                        break;
                    case DateTime dt:
                        cell.SetValue(dt);
                        cell.Style.DateFormat.Format = "dd/mm/yyyy hh:mm";
                        break;
                    case decimal m: cell.SetValue(m); break;
                    case int i: cell.SetValue(i); break;
                    // El texto se guarda como texto: un valor que empiece con «=» no se convierte en fórmula.
                    case var other: cell.SetValue(other.ToString()); break;
                }
            }
            if (data.Rows.Count > 0) sheet.Range(1, 1, data.Rows.Count + 1, data.Headers.Count).SetAutoFilter();
            sheet.Columns(1, data.Headers.Count).AdjustToContents(1, Math.Min(data.Rows.Count + 1, 300), 10, 50);
        }
        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }
}
