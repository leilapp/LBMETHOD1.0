using LBMethod.Api.Security;
using LBMethod.Application.Exports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LBMethod.Api.Controllers.Trainer;

/// <summary>PDF de rutinas y exportaciones a Excel de la entrenadora. Solo sus propios datos; lo ajeno responde 404.</summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer")]
public class ExportsController(ExportService exports) : ControllerBase
{
    /// <summary>PDF de una versión de rutina o plantilla (sin datos de cliente).</summary>
    [HttpGet("routines/{id:int}/versions/{versionId:int}/pdf")]
    public async Task<IActionResult> RoutinePdf(int id, int versionId, CancellationToken ct) =>
        Download(await exports.RoutineVersionPdfAsync(id, versionId, ct));

    /// <summary>PDF de una rutina asignada, con cliente, fechas e indicaciones.</summary>
    [HttpGet("assignments/{id:int}/pdf")]
    public async Task<IActionResult> AssignmentPdf(int id, CancellationToken ct) =>
        Download(await exports.AssignmentPdfAsync(id, ct));

    [HttpGet("exports/clients")]
    public async Task<IActionResult> Clients(CancellationToken ct) => Download(await exports.ClientsExcelAsync(ct));

    [HttpGet("exports/routines")]
    public async Task<IActionResult> Routines(CancellationToken ct) => Download(await exports.RoutinesExcelAsync(ct));

    /// <summary>Evaluaciones y medidas de todos los clientes o, con clientId, de uno.</summary>
    [HttpGet("exports/evaluations")]
    public async Task<IActionResult> Evaluations([FromQuery] int? clientId, CancellationToken ct) =>
        Download(await exports.EvaluationsExcelAsync(clientId, ct));

    private IActionResult Download(ExportFile? file) => file is null ? NotFound() : File(file.Content, file.ContentType, file.FileName);
}
