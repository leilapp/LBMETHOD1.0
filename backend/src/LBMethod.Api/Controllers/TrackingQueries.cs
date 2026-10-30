using LBMethod.Api.Contracts;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Tracking;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers;

/// <summary>Lecturas de evaluaciones y fotos de un cliente, compartidas por la entrenadora y el portal. Quien llama ya comprobó el acceso.</summary>
public static class TrackingQueries
{
    public static async Task<List<PhotoResponse>> PhotosAsync(IAppDbContext db, int clientId, Func<int, string> photoUrl, CancellationToken ct) =>
        (await db.ProgressPhotos.AsNoTracking().Where(p => p.ClientId == clientId && p.StoredFile.DeletedAt == null)
            .OrderByDescending(p => p.TakenOn).ThenByDescending(p => p.Id)
            .Select(p => new { p.Id, p.TakenOn, p.Category, p.EvaluationId, p.Notes })
            .ToListAsync(ct))
        .Select(p => new PhotoResponse(p.Id, p.TakenOn, (int?)p.Category, p.Category is { } c ? TrackingLabels.PhotoCategories[c] : null, p.EvaluationId, p.Notes, photoUrl(p.Id)))
        .ToList();

    public static async Task<List<EvaluationResponse>> EvaluationsAsync(IAppDbContext db, int clientId, Func<int, string> photoUrl, CancellationToken ct)
    {
        var evaluations = await db.Evaluations.AsNoTracking().Where(e => e.ClientId == clientId)
            .OrderByDescending(e => e.EvaluatedOn).ThenByDescending(e => e.Id)
            .Select(e => new
            {
                e.Id, e.EvaluatedOn, e.Notes, e.CreatedAt,
                Measurements = e.Measurements.OrderBy(m => m.MeasurementType.SortOrder).Select(m => new MeasurementResponse(
                    m.Id, m.MeasurementTypeId, m.MeasurementType.NameEs, m.MeasurementType.Kind.ToString(), m.Value, m.Unit, m.Notes)).ToList()
            })
            .AsSplitQuery()
            .ToListAsync(ct);
        var photos = (await PhotosAsync(db, clientId, photoUrl, ct)).Where(p => p.EvaluationId != null).ToLookup(p => p.EvaluationId!.Value);
        return evaluations.Select(e => new EvaluationResponse(e.Id, e.EvaluatedOn, e.Notes, e.CreatedAt, e.Measurements, photos[e.Id].ToList())).ToList();
    }
}
