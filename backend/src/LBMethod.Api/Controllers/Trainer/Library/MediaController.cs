using LBMethod.Application.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LBMethod.Api.Controllers.Trainer.Library;

/// <summary>
/// Entrega los archivos privados de la biblioteca. No existen URLs públicas: cada descarga pasa por aquí
/// y exige sesión con permisos. El acceso de los clientes a los medios de sus rutinas llega en la Fase 8.
/// </summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/library/media")]
public class MediaController(MediaService media) : ControllerBase
{
    [HttpGet("{mediaId:int}/content")]
    public async Task<IActionResult> Content(int mediaId, CancellationToken ct)
    {
        var content = await media.OpenAsync(mediaId, ct);
        if (content is null) return NotFound();
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers.ContentDisposition = "inline";
        // Range permite adelantar los videos sin descargarlos completos.
        return File(content.Content, content.ContentType, enableRangeProcessing: true);
    }
}
