using LBMethod.Api.Contracts;
using LBMethod.Api.Controllers.Trainer;
using LBMethod.Api.Controllers.Trainer.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Security;
using LBMethod.Application.Tracking;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LBMethod.Api.Controllers.Portal;

/// <summary>Progreso, evaluaciones, fotos y calendario del propio cliente (solo lectura). Nunca se aceptan Ids de cliente.</summary>
[ApiController]
[Authorize(Policy = Policies.Client)]
[Route("api/portal")]
public class ProgressController(ProgressService progress, TrackingService tracking, CalendarService calendar, ClientAccess access, IAppDbContext db) : ControllerBase
{
    private static string PhotoUrl(int id) => $"/api/portal/photos/{id}/content";

    [HttpGet("progress")]
    public async Task<ActionResult<ProgressResult>> Progress(CancellationToken ct) =>
        await access.CurrentClientIdAsync(ct) is { } clientId && await progress.BuildAsync(clientId, ct) is { } result ? result : NotFound();

    [HttpGet("evaluations")]
    public async Task<ActionResult<IReadOnlyList<EvaluationResponse>>> Evaluations(CancellationToken ct) =>
        await access.CurrentClientIdAsync(ct) is { } clientId ? await TrackingQueries.EvaluationsAsync(db, clientId, PhotoUrl, ct) : NotFound();

    [HttpGet("photos")]
    public async Task<ActionResult<IReadOnlyList<PhotoResponse>>> Photos(CancellationToken ct) =>
        await access.CurrentClientIdAsync(ct) is { } clientId ? await TrackingQueries.PhotosAsync(db, clientId, PhotoUrl, ct) : NotFound();

    [HttpGet("photos/{id:int}/content")]
    public async Task<IActionResult> PhotoContent(int id, CancellationToken ct) => await PrivateFile.ServeAsync(this, await tracking.OpenPhotoAsync(id, ct));

    [HttpGet("calendar")]
    public async Task<IActionResult> Calendar([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
    {
        if (CalendarRange.Check(from, to) is { } invalid) return this.ToResponse(invalid, NoContent);
        var items = await calendar.BuildAsync(from!.Value, to!.Value, null, ct);
        return items is null ? NotFound() : Ok(items);
    }
}
