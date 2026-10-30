using LBMethod.Application.Abstractions;
using LBMethod.Application.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Security;
using LBMethod.Domain.Exercises;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Trainer.Library;

/// <summary>Plantilla de Excel, importación con vista previa y exportación del catálogo.</summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/library/exercises")]
public class ImportExportController(IAppDbContext db, IExerciseSpreadsheet spreadsheet, ExerciseImportService import, TimeProvider clock) : ControllerBase
{
    private const string XlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private const long MaxImportBytes = 10 * 1024 * 1024;

    [HttpGet("import/template")]
    public async Task<IActionResult> Template(CancellationToken ct) =>
        File(spreadsheet.BuildTemplate(await Catalogs(ct)), XlsxType, "plantilla-ejercicios-lbmethod.xlsx");

    /// <summary>Revisa el archivo sin guardar nada y devuelve el estado de cada fila.</summary>
    [HttpPost("import/preview")]
    public Task<IActionResult> Preview([FromForm] IFormFile? file, CancellationToken ct) =>
        WithFile(file, async stream => Ok(await import.PreviewAsync(stream, ct)));

    /// <summary>Guarda solo las filas válidas y devuelve el reporte de filas rechazadas.</summary>
    [HttpPost("import/commit")]
    public Task<IActionResult> Commit([FromForm] IFormFile? file, CancellationToken ct) =>
        WithFile(file, async stream => Ok(await import.CommitAsync(stream, ct)));

    /// <summary>Exporta el catálogo. status: all (predeterminado), active o inactive.</summary>
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] string? status, CancellationToken ct)
    {
        var query = db.Exercises.AsNoTracking();
        if (status == "active") query = query.Where(e => e.IsActive);
        if (status == "inactive") query = query.Where(e => !e.IsActive);

        var exercises = await query.OrderBy(e => e.NameEs)
            .Select(e => new
            {
                e.NameEs, e.NameEn, e.Description, e.Type, e.Difficulty, e.Instructions, e.CommonMistakes, e.TechnicalTips, e.IsActive,
                Pattern = e.MovementPattern != null ? e.MovementPattern.NameEs : null,
                Muscles = e.Muscles.Select(m => new { m.Role, m.MuscleGroup.NameEs, m.MuscleGroup.SortOrder }).ToList(),
                Equipment = e.Equipment.Select(x => x.Equipment.NameEs).ToList()
            })
            .AsSplitQuery()
            .ToListAsync(ct);

        var sep = $"{IExerciseSpreadsheet.ListSeparator} ";
        var rows = exercises.Select((e, i) => new SpreadsheetRow(i + 2,
            e.NameEs, e.NameEn, e.Description,
            e.Muscles.FirstOrDefault(m => m.Role == MuscleRole.Primary)?.NameEs,
            string.Join(sep, e.Muscles.Where(m => m.Role == MuscleRole.Secondary).OrderBy(m => m.SortOrder).Select(m => m.NameEs)),
            string.Join(sep, e.Equipment.Order()),
            LibraryLabels.Types[e.Type], e.Pattern,
            e.Difficulty is { } d ? LibraryLabels.Difficulties[d] : null,
            e.Instructions, e.CommonMistakes, e.TechnicalTips, e.IsActive ? "Sí" : "No"));

        var today = TimeZoneInfo.ConvertTime(clock.GetUtcNow(), Domain.Common.BusinessTime.TimeZone).ToString("yyyy-MM-dd");
        return File(spreadsheet.BuildExport(rows, await Catalogs(ct)), XlsxType, $"biblioteca-lbmethod-{today}.xlsx");
    }

    private async Task<IActionResult> WithFile(IFormFile? file, Func<Stream, Task<IActionResult>> action)
    {
        if (file is null || file.Length == 0) return Problem("file", "Selecciona un archivo de Excel (.xlsx).");
        if (file.Length > MaxImportBytes) return Problem("file", "El archivo supera 10 MB.");
        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase)) return Problem("file", "El archivo debe ser de Excel (.xlsx).");

        // ClosedXML necesita poder recorrer el archivo; se copia a memoria (máximo 10 MB).
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer);
        buffer.Position = 0;
        try { return await action(buffer); }
        catch (SpreadsheetFormatException ex) { return Problem("file", ex.Message); }
    }

    private IActionResult Problem(string field, string message) =>
        ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { [field] = [message] }));

    private async Task<CatalogLists> Catalogs(CancellationToken ct) => new(
        await db.MuscleGroups.Where(m => m.IsActive).OrderBy(m => m.SortOrder).Select(m => m.NameEs).ToListAsync(ct),
        await db.Equipment.Where(e => e.IsActive).OrderBy(e => e.NameEs).Select(e => e.NameEs).ToListAsync(ct),
        await db.MovementPatterns.Where(p => p.IsActive).OrderBy(p => p.NameEs).Select(p => p.NameEs).ToListAsync(ct),
        LibraryLabels.Types.Values.ToList(),
        LibraryLabels.Difficulties.Values.ToList());
}
