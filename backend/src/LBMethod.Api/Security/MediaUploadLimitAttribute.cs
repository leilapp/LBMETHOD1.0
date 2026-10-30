using LBMethod.Application.Library;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc.Filters;

namespace LBMethod.Api.Security;

/// <summary>
/// Amplía el tamaño máximo de la petición solo en los endpoints de subida de archivos, hasta el límite
/// configurado para videos (o fotos de progreso, si es mayor). El resto de la API conserva el límite general del servidor.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class MediaUploadLimitAttribute : Attribute, IResourceFilter
{
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        var limits = context.HttpContext.RequestServices.GetRequiredService<MediaLimits>();
        var feature = context.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
        var photos = context.HttpContext.RequestServices.GetService<LBMethod.Application.Tracking.TrackingLimits>()?.MaxPhotoBytes ?? 0;
        if (feature is { IsReadOnly: false }) feature.MaxRequestBodySize = Math.Max(Math.Max(limits.MaxVideoBytes, limits.MaxImageBytes), photos) + 1024 * 1024;
    }

    public void OnResourceExecuted(ResourceExecutedContext context) { }
}
