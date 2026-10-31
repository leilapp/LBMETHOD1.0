using System.Globalization;
using LBMethod.Application.Exports;
using MigraDoc.DocumentObjectModel;
using MigraDoc.DocumentObjectModel.Tables;
using MigraDoc.Rendering;
using PdfSharp.Fonts;

namespace LBMethod.Infrastructure.Files;

/// <summary>
/// PDF de una rutina con la identidad de LB METHOD: encabezado con la marca en cada página, datos del programa,
/// un bloque por día con la tabla de ejercicios (el encabezado de la tabla se repite al cambiar de página) y pie con
/// «Página X de Y». Las fuentes van incluidas en el programa, así que los acentos y la «ñ» se ven igual en Windows y en Linux.
/// </summary>
public class MigraDocRoutinePdf : IRoutinePdfRenderer
{
    private const string Sans = "LB Sans";
    private const string Serif = "LB Serif";
    private static readonly Color Violet = Color.Parse("#3B2566");
    private static readonly Color Gold = Color.Parse("#B89B5E");
    private static readonly Color Muted = Color.Parse("#6B6480");
    private static readonly Color Rule = Color.Parse("#D9CDF2");
    private static readonly Color Band = Color.Parse("#F4F0FB");
    private static readonly CultureInfo Mx = CultureInfo.GetCultureInfo("es-MX");
    private static readonly object FontLock = new();

    public MigraDocRoutinePdf()
    {
        lock (FontLock)
            GlobalFontSettings.FontResolver ??= new EmbeddedFontResolver();
    }

    public byte[] Render(RoutineDocument data)
    {
        var doc = new Document();
        doc.Info.Title = data.Title;
        doc.Info.Author = "LB METHOD";
        doc.Info.Subject = data.ClientName is null ? "Rutina" : $"Rutina de {data.ClientName}";
        doc.Styles[StyleNames.Normal]!.Font.Name = Sans;
        doc.Styles[StyleNames.Normal]!.Font.Size = 9.5;
        doc.Styles[StyleNames.Normal]!.Font.Color = Color.Parse("#1D1A26");

        var section = doc.AddSection();
        var page = section.PageSetup;
        page.PageFormat = PageFormat.A4;
        page.TopMargin = Unit.FromCentimeter(2.6);
        page.BottomMargin = Unit.FromCentimeter(2);
        page.LeftMargin = page.RightMargin = Unit.FromCentimeter(1.8);
        page.HeaderDistance = Unit.FromCentimeter(1);
        page.FooterDistance = Unit.FromCentimeter(0.9);

        Header(section, data);
        Footer(section, data);
        Summary(section, data);
        if (data.Days.Count == 0)
            section.AddParagraph("Esta rutina todavía no tiene días.").Format.Font.Color = Muted;
        foreach (var day in data.Days) Day(section, day);

        var renderer = new PdfDocumentRenderer { Document = doc };
        renderer.RenderDocument();
        using var ms = new MemoryStream();
        renderer.PdfDocument.Save(ms, false);
        return ms.ToArray();
    }

    private static void Header(Section section, RoutineDocument data)
    {
        var table = section.Headers.Primary.AddTable();
        table.AddColumn(Unit.FromCentimeter(7));
        table.AddColumn(Unit.FromCentimeter(10.4));
        var row = table.AddRow();
        row.Borders.Bottom.Color = Gold;
        row.Borders.Bottom.Width = 0.75;
        row.BottomPadding = Unit.FromPoint(4);
        var brand = row.Cells[0].AddParagraph();
        brand.Format.Font.Name = Serif;
        brand.Format.Font.Size = 14;
        brand.AddFormattedText("LB ").Color = Violet;
        brand.AddFormattedText("METHOD").Color = Gold;
        var right = row.Cells[1].AddParagraph(data.ClientName is null ? data.Title : $"{data.Title} · {data.ClientName}");
        right.Format.Alignment = ParagraphAlignment.Right;
        right.Format.Font.Size = 8;
        right.Format.Font.Color = Muted;
        row.Cells[1].VerticalAlignment = VerticalAlignment.Bottom;
    }

    private static void Footer(Section section, RoutineDocument data)
    {
        var p = section.Footers.Primary.AddParagraph();
        p.Format.Alignment = ParagraphAlignment.Center;
        p.Format.Font.Size = 7.5;
        p.Format.Font.Color = Muted;
        p.AddText($"Generado el {data.GeneratedAtLocal.ToString("d 'de' MMMM 'de' yyyy, HH:mm", Mx)} (hora del centro de México) · Página ");
        p.AddPageField();
        p.AddText(" de ");
        p.AddNumPagesField();
    }

    private static void Summary(Section section, RoutineDocument data)
    {
        var title = section.AddParagraph(data.Title);
        title.Format.Font.Name = Serif;
        title.Format.Font.Size = 20;
        title.Format.Font.Color = Violet;
        title.Format.SpaceAfter = Unit.FromPoint(2);
        var version = section.AddParagraph($"Versión {data.VersionNumber}{(data.IsDraft ? " · Borrador (aún no publicada)" : "")}");
        version.Format.Font.Color = Muted;
        version.Format.SpaceAfter = Unit.FromPoint(10);

        var rows = new List<(string, string)>();
        if (data.ClientName is not null) rows.Add(("Cliente", data.ClientName));
        rows.Add(("Programa", data.Title));
        if (data.Goal is not null) rows.Add(("Objetivo", data.Goal));
        if (data.StartDate is { } start)
            rows.Add(("Fechas", data.EndDate is { } end ? $"Del {Date(start)} al {Date(end)}" : $"Desde el {Date(start)} (sin fecha de fin)"));
        if (data.DurationWeeks is { } weeks) rows.Add(("Duración", weeks == 1 ? "1 semana" : $"{weeks} semanas"));
        rows.Add(("Días", data.Days.Count == 1 ? "1 día de entrenamiento" : $"{data.Days.Count} días de entrenamiento"));
        if (data.AssignmentStatus is not null) rows.Add(("Estado", data.AssignmentStatus));
        if (data.Description is not null) rows.Add(("Descripción", data.Description));
        if (data.AssignmentNotes is not null) rows.Add(("Indicaciones", data.AssignmentNotes));

        var table = section.AddTable();
        table.Borders.Color = Rule;
        table.Borders.Width = 0.5;
        table.LeftPadding = table.RightPadding = Unit.FromPoint(6);
        table.TopPadding = table.BottomPadding = Unit.FromPoint(3);
        table.AddColumn(Unit.FromCentimeter(3.4));
        table.AddColumn(Unit.FromCentimeter(14));
        foreach (var (label, value) in rows)
        {
            var row = table.AddRow();
            row.Cells[0].Shading.Color = Band;
            var l = row.Cells[0].AddParagraph(label);
            l.Format.Font.Bold = true;
            l.Format.Font.Color = Violet;
            row.Cells[1].AddParagraph(value);
        }
        section.AddParagraph().Format.SpaceAfter = Unit.FromPoint(6);
    }

    private static readonly (string Header, double Cm, ParagraphAlignment Align)[] Columns =
    [
        ("#", 0.8, ParagraphAlignment.Center),
        ("Ejercicio", 5.6, ParagraphAlignment.Left),
        ("Series", 1.3, ParagraphAlignment.Center),
        ("Reps", 1.6, ParagraphAlignment.Center),
        ("Peso", 2.0, ParagraphAlignment.Center),
        ("Descanso", 1.9, ParagraphAlignment.Center),
        ("Tempo", 1.6, ParagraphAlignment.Center),
        ("RIR / RPE", 2.6, ParagraphAlignment.Center),
    ];

    private static void Day(Section section, RoutineDocumentDay day)
    {
        var heading = section.AddParagraph();
        heading.Format.SpaceBefore = Unit.FromPoint(8);
        heading.Format.SpaceAfter = Unit.FromPoint(3);
        heading.Format.KeepWithNext = true;
        heading.Format.Font.Name = Serif;
        heading.Format.Font.Size = 13;
        heading.Format.Font.Color = Violet;
        heading.AddText(day.Name.StartsWith("Día", StringComparison.OrdinalIgnoreCase) ? day.Name : $"Día {day.Position} · {day.Name}");
        if (day.DayOfWeek is not null) heading.AddFormattedText($"   {day.DayOfWeek}").Color = Gold;
        if (day.Notes is not null)
        {
            var notes = section.AddParagraph(day.Notes);
            notes.Format.KeepWithNext = true;
            notes.Format.Font.Color = Muted;
            notes.Format.SpaceAfter = Unit.FromPoint(3);
        }
        if (day.Exercises.Count == 0)
        {
            section.AddParagraph("Sin ejercicios.").Format.Font.Color = Muted;
            return;
        }

        var table = section.AddTable();
        table.Borders.Color = Rule;
        table.Borders.Width = 0.5;
        table.LeftPadding = table.RightPadding = Unit.FromPoint(4);
        table.TopPadding = table.BottomPadding = Unit.FromPoint(3);
        foreach (var c in Columns) table.AddColumn(Unit.FromCentimeter(c.Cm));

        var head = table.AddRow();
        head.HeadingFormat = true; // se repite si la tabla continúa en otra página
        head.Shading.Color = Violet;
        for (var i = 0; i < Columns.Length; i++)
        {
            var p = head.Cells[i].AddParagraph(Columns[i].Header);
            p.Format.Font.Bold = true;
            p.Format.Font.Size = 8.5;
            p.Format.Font.Color = Colors.White;
            p.Format.Alignment = Columns[i].Align;
        }

        foreach (var e in day.Exercises)
        {
            var details = Details(e);
            var row = table.AddRow();
            row.VerticalAlignment = VerticalAlignment.Center;
            if (details.Count > 0) row.KeepWith = 1; // el ejercicio y su detalle no se separan entre páginas
            var perSet = e.SetDetails.Count > 0 ? "por serie" : null;
            string?[] values = [e.Position.ToString(Mx), null, e.Sets.ToString(Mx), e.Reps ?? perSet, e.Weight ?? perSet, e.Rest ?? perSet, e.Tempo, e.Effort ?? perSet];
            for (var i = 0; i < Columns.Length; i++)
            {
                var p = row.Cells[i].AddParagraph();
                p.Format.Alignment = Columns[i].Align;
                if (i == 1)
                {
                    p.AddFormattedText(e.Name).Bold = true;
                    if (e.Superset is not null) p.AddFormattedText($"  Superserie {e.Superset}").Color = Gold;
                    if (e.NameEn is not null && e.NameEn != e.Name)
                    {
                        var en = row.Cells[i].AddParagraph(e.NameEn);
                        en.Format.Font.Size = 8;
                        en.Format.Font.Color = Muted;
                    }
                }
                else p.AddText(values[i] ?? "—");
            }
            if (details.Count == 0) continue;
            var detail = table.AddRow();
            detail.Cells[0].MergeRight = Columns.Length - 1;
            detail.Cells[0].Shading.Color = Band;
            foreach (var line in details)
            {
                var p = detail.Cells[0].AddParagraph(line);
                p.Format.Font.Size = 8.5;
                p.Format.LeftIndent = Unit.FromCentimeter(0.8);
            }
        }
    }

    private static List<string> Details(RoutineDocumentExercise e)
    {
        var lines = new List<string>();
        if (e.SetType != "Efectiva" && e.SetDetails.Count == 0) lines.Add($"Tipo de serie: {e.SetType}");
        foreach (var s in e.SetDetails)
        {
            var parts = new List<string> { $"Serie {s.SetNumber} · {s.SetType}" };
            if (s.Reps is not null) parts.Add($"{s.Reps} reps");
            if (s.Weight is not null) parts.Add(s.Weight);
            if (s.Rest is not null) parts.Add($"{s.Rest} descanso");
            if (s.Effort is not null) parts.Add(s.Effort);
            if (s.Notes is not null) parts.Add(s.Notes);
            lines.Add(string.Join(" · ", parts));
        }
        if (e.Notes is not null) lines.Add($"Notas: {e.Notes}");
        return lines;
    }

    private static string Date(DateOnly d) => d.ToString("d 'de' MMMM 'de' yyyy", Mx);

    /// <summary>Fuentes DejaVu incluidas como recurso (licencia libre en Files/Fonts/LICENSE-DejaVu.txt).</summary>
    private sealed class EmbeddedFontResolver : IFontResolver
    {
        public FontResolverInfo? ResolveTypeface(string familyName, bool bold, bool italic) =>
            familyName == Serif
                ? new FontResolverInfo("DejaVuSerif-Bold", false, italic)
                : new FontResolverInfo(bold ? "DejaVuSans-Bold" : "DejaVuSans", false, italic);

        public byte[]? GetFont(string faceName)
        {
            using var stream = typeof(MigraDocRoutinePdf).Assembly.GetManifestResourceStream($"LBMethod.Fonts.{faceName}.ttf");
            if (stream is null) return null;
            using var ms = new MemoryStream();
            stream.CopyTo(ms);
            return ms.ToArray();
        }
    }
}
