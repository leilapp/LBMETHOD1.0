using LBMethod.Api.Security;
using LBMethod.Application.Exports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LBMethod.Api.Controllers.Portal;

/// <summary>Documentos que el cliente puede descargar: el PDF de sus rutinas vigentes o programadas.</summary>
[ApiController]
[Authorize(Policy = Policies.Client)]
[Route("api/portal")]
public class DocumentsController(ExportService exports) : ControllerBase
{
    [HttpGet("program/{assignmentId:int}/pdf")]
    public async Task<IActionResult> ProgramPdf(int assignmentId, CancellationToken ct) =>
        await exports.AssignmentPdfAsync(assignmentId, ct) is { } file ? File(file.Content, file.ContentType, file.FileName) : NotFound();
}
