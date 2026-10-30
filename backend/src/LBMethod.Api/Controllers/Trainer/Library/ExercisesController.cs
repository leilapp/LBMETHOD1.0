using LBMethod.Api.Contracts;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Library;
using LBMethod.Application.Security;
using LBMethod.Domain.Exercises;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Trainer.Library;

/// <summary>Catálogo central de ejercicios: consulta, alta, edición, desactivación, favoritos, variantes y medios.</summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/library/exercises")]
public class ExercisesController(IAppDbContext db, ExerciseService exercises, MediaService media, ICurrentUser user) : ControllerBase
{
    public const int MaxPageSize = 100;

    /// <summary>
    /// Búsqueda en español o inglés (sin distinguir mayúsculas ni acentos) con filtros.
    /// status: active (predeterminado), inactive o all.
    /// </summary>
    [HttpGet]
    public async Task<PagedResponse<ExerciseListItemResponse>> List(
        [FromQuery] string? q, [FromQuery] int? muscleGroupId, [FromQuery] int? equipmentId, [FromQuery] int? movementPatternId,
        [FromQuery] ExerciseType? type, [FromQuery] string? status, [FromQuery] bool favorites = false,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var userId = user.UserId;

        var query = db.Exercises.AsQueryable();
        query = status switch
        {
            "inactive" => query.Where(e => !e.IsActive),
            "all" => query,
            _ => query.Where(e => e.IsActive)
        };
        if (NameNormalizer.CleanOptional(q) is { } term)
        {
            term = NameNormalizer.Clean(term);
            if (term.Length > 100) term = term[..100];
            // La intercalación de las columnas de nombre ignora mayúsculas y acentos.
            query = query.Where(e => e.NameEs.Contains(term) || (e.NameEn != null && e.NameEn.Contains(term)));
        }
        if (muscleGroupId is { } m) query = query.Where(e => e.Muscles.Any(x => x.MuscleGroupId == m));
        if (equipmentId is { } eq) query = query.Where(e => e.Equipment.Any(x => x.EquipmentId == eq));
        if (movementPatternId is { } p) query = query.Where(e => e.MovementPatternId == p);
        if (type is { } t) query = query.Where(e => e.Type == t);
        if (favorites) query = query.Where(e => db.ExerciseFavorites.Any(f => f.UserId == userId && f.ExerciseId == e.Id));

        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(e => e.NameEs).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(e => new
            {
                e.Id, e.NameEs, e.NameEn, e.Type, e.IsActive,
                Primary = e.Muscles.Where(x => x.Role == MuscleRole.Primary).Select(x => x.MuscleGroup.NameEs).FirstOrDefault(),
                Equipment = e.Equipment.Select(x => x.Equipment.NameEs).ToList(),
                Pattern = e.MovementPattern != null ? e.MovementPattern.NameEs : null,
                Favorite = db.ExerciseFavorites.Any(f => f.UserId == userId && f.ExerciseId == e.Id),
                Thumbnail = e.Media.Where(x => x.MediaType == MediaType.Image && x.StoredFileId != null)
                    .OrderBy(x => x.SortOrder).Select(x => (int?)x.Id).FirstOrDefault()
            })
            .ToListAsync(ct);

        return new PagedResponse<ExerciseListItemResponse>(rows.Select(r => new ExerciseListItemResponse(
            r.Id, r.NameEs, r.NameEn, (int)r.Type, LibraryLabels.Types[r.Type], r.Primary, r.Equipment.Order().ToList(),
            r.Pattern, r.IsActive, r.Favorite, r.Thumbnail)).ToList(), total, page, pageSize);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ExerciseDetailResponse>> Get(int id, CancellationToken ct)
    {
        var e = await db.Exercises.AsNoTracking()
            .Include(x => x.MovementPattern)
            .Include(x => x.Muscles).ThenInclude(x => x.MuscleGroup)
            .Include(x => x.Equipment).ThenInclude(x => x.Equipment)
            .Include(x => x.Media).ThenInclude(x => x.StoredFile)
            .AsSplitQuery()
            .SingleOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return NotFound();

        var userId = user.UserId;
        var favorite = await db.ExerciseFavorites.AnyAsync(f => f.UserId == userId && f.ExerciseId == id, ct);
        // Las variantes se muestran en ambos sentidos: si A es variante de B, B también aparece en A.
        var variants = await db.ExerciseVariants.Where(v => v.ExerciseId == id)
            .Select(v => new ExerciseVariantResponse(v.VariantExerciseId, v.VariantExercise.NameEs, v.VariantExercise.NameEn, v.VariantExercise.IsActive, v.Note))
            .ToListAsync(ct);
        variants.AddRange(await db.ExerciseVariants.Where(v => v.VariantExerciseId == id)
            .Select(v => new ExerciseVariantResponse(v.ExerciseId, v.Exercise.NameEs, v.Exercise.NameEn, v.Exercise.IsActive, v.Note))
            .ToListAsync(ct));

        static NamedRef Ref(int id, string es, string en) => new(id, es, en);
        var primary = e.Muscles.FirstOrDefault(m => m.Role == MuscleRole.Primary);
        return new ExerciseDetailResponse(
            e.Id, e.NameEs, e.NameEn, e.Description, e.Instructions, e.CommonMistakes, e.TechnicalTips,
            (int)e.Type, LibraryLabels.Types[e.Type],
            e.Difficulty is { } d ? (int)d : null, e.Difficulty is { } d2 ? LibraryLabels.Difficulties[d2] : null,
            e.MovementPattern is { } p ? Ref(p.Id, p.NameEs, p.NameEn) : null,
            primary is null ? null : Ref(primary.MuscleGroupId, primary.MuscleGroup.NameEs, primary.MuscleGroup.NameEn),
            e.Muscles.Where(m => m.Role == MuscleRole.Secondary).OrderBy(m => m.MuscleGroup.SortOrder)
                .Select(m => Ref(m.MuscleGroupId, m.MuscleGroup.NameEs, m.MuscleGroup.NameEn)).ToList(),
            e.Equipment.OrderBy(x => x.Equipment.NameEs).Select(x => Ref(x.EquipmentId, x.Equipment.NameEs, x.Equipment.NameEn)).ToList(),
            e.IsActive, e.DeactivatedAt, favorite,
            variants.OrderBy(v => v.NameEs).ToList(),
            e.Media.OrderBy(m => m.SortOrder).Select(m => new ExerciseMediaResponse(
                m.Id, m.MediaType.ToString(), m.Title, m.ExternalUrl,
                m.StoredFileId is null ? null : $"/api/trainer/library/media/{m.Id}/content",
                m.StoredFile?.OriginalFileName, m.StoredFile?.SizeBytes)).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Create(ExerciseRequest request, CancellationToken ct)
    {
        var result = await exercises.CreateAsync(Input(request), ct);
        return this.ToResponse(result, () => CreatedAtAction(nameof(Get), new { id = result.Id }, new IdResponse(result.Id)));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ExerciseRequest request, CancellationToken ct) =>
        this.ToResponse(await exercises.UpdateAsync(id, Input(request), ct), NoContent);

    /// <summary>Activa o desactiva. Desactivar no modifica rutinas ni historial que ya usan el ejercicio.</summary>
    [HttpPost("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, SetActiveRequest request, CancellationToken ct) =>
        this.ToResponse(await exercises.SetActiveAsync(id, request.Active!.Value, ct), NoContent);

    [HttpPut("{id:int}/favorite")]
    public async Task<IActionResult> AddFavorite(int id, CancellationToken ct) =>
        this.ToResponse(await exercises.SetFavoriteAsync(id, true, ct), NoContent);

    [HttpDelete("{id:int}/favorite")]
    public async Task<IActionResult> RemoveFavorite(int id, CancellationToken ct) =>
        this.ToResponse(await exercises.SetFavoriteAsync(id, false, ct), NoContent);

    [HttpPost("{id:int}/variants")]
    public async Task<IActionResult> AddVariant(int id, AddVariantRequest request, CancellationToken ct) =>
        this.ToResponse(await exercises.AddVariantAsync(id, request.VariantExerciseId!.Value, request.Note, ct), NoContent);

    [HttpDelete("{id:int}/variants/{variantId:int}")]
    public async Task<IActionResult> RemoveVariant(int id, int variantId, CancellationToken ct) =>
        this.ToResponse(await exercises.RemoveVariantAsync(id, variantId, ct), NoContent);

    /// <summary>Sube una imagen (JPG, PNG, WEBP) o un video (MP4, WEBM). El tipo se verifica por el contenido.</summary>
    [HttpPost("{id:int}/media")]
    [MediaUploadLimit]
    public async Task<IActionResult> Upload(int id, [FromForm] IFormFile? file, [FromForm] string? title, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["file"] = ["Selecciona un archivo."] }));
        if (title?.Length > 150)
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["title"] = ["Máximo 150 caracteres."] }));
        await using var stream = file.OpenReadStream();
        var result = await media.UploadAsync(id, file.FileName, stream, file.Length, title, ct);
        return this.ToResponse(result, () => StatusCode(StatusCodes.Status201Created, new IdResponse(result.Id)));
    }

    /// <summary>Agrega un enlace externo (por ejemplo, un video de YouTube). Solo se aceptan enlaces https.</summary>
    [HttpPost("{id:int}/media/link")]
    public async Task<IActionResult> AddLink(int id, AddMediaLinkRequest request, CancellationToken ct)
    {
        var result = await media.AddLinkAsync(id, request.Url, request.MediaType!.Value, request.Title, ct);
        return this.ToResponse(result, () => StatusCode(StatusCodes.Status201Created, new IdResponse(result.Id)));
    }

    [HttpDelete("{id:int}/media/{mediaId:int}")]
    public async Task<IActionResult> DeleteMedia(int id, int mediaId, CancellationToken ct) =>
        this.ToResponse(await media.DeleteAsync(id, mediaId, ct), NoContent);

    private static ExerciseInput Input(ExerciseRequest r) => new(
        r.NameEs, r.NameEn, r.Description, r.Instructions, r.CommonMistakes, r.TechnicalTips,
        r.Type!.Value, r.Difficulty, r.MovementPatternId, r.PrimaryMuscleGroupId!.Value,
        r.SecondaryMuscleGroupIds ?? [], r.EquipmentIds ?? []);
}
