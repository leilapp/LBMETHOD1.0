using LBMethod.Api.Contracts;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Security;
using LBMethod.Domain.Exercises;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Trainer.Library;

/// <summary>
/// Grupos musculares, equipamiento y patrones de movimiento. La entrenadora puede agregarlos, renombrarlos
/// y desactivarlos; nunca se borran porque los ejercicios existentes los siguen usando.
/// </summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/library")]
public class CatalogsController(IAppDbContext db, CatalogService catalogs) : ControllerBase
{
    [HttpGet("catalogs")]
    public async Task<LibraryCatalogsResponse> All(CancellationToken ct) => new(
        await MuscleGroups(ct), await EquipmentList(ct), await Patterns(ct),
        LibraryLabels.Types.Select(t => new OptionResponse((int)t.Key, t.Value)).ToList(),
        LibraryLabels.Difficulties.Select(d => new OptionResponse((int)d.Key, d.Value)).ToList());

    [HttpGet("muscle-groups")]
    public Task<List<CatalogItemResponse>> MuscleGroups(CancellationToken ct) =>
        db.MuscleGroups.OrderBy(m => m.SortOrder).ThenBy(m => m.NameEs)
            .Select(m => new CatalogItemResponse(m.Id, m.NameEs, m.NameEn, m.IsActive,
                db.ExerciseMuscles.Count(x => x.MuscleGroupId == m.Id)))
            .ToListAsync(ct);

    [HttpPost("muscle-groups")]
    public async Task<IActionResult> CreateMuscleGroup(CatalogItemRequest request, CancellationToken ct)
    {
        // Los nuevos grupos se agregan al final del orden de presentación.
        var nextOrder = (await db.MuscleGroups.MaxAsync(m => (int?)m.SortOrder, ct) ?? 0) + 1;
        return Created(await catalogs.SaveAsync(db.MuscleGroups, null, Input(request), () => new MuscleGroup { SortOrder = nextOrder }, ct));
    }

    [HttpPut("muscle-groups/{id:int}")]
    public async Task<IActionResult> UpdateMuscleGroup(int id, CatalogItemRequest request, CancellationToken ct) =>
        this.ToResponse(await catalogs.SaveAsync(db.MuscleGroups, id, Input(request), () => new MuscleGroup(), ct), NoContent);

    [HttpGet("equipment")]
    public Task<List<CatalogItemResponse>> EquipmentList(CancellationToken ct) =>
        db.Equipment.OrderBy(e => e.NameEs)
            .Select(e => new CatalogItemResponse(e.Id, e.NameEs, e.NameEn, e.IsActive,
                db.ExerciseEquipment.Count(x => x.EquipmentId == e.Id)))
            .ToListAsync(ct);

    [HttpPost("equipment")]
    public async Task<IActionResult> CreateEquipment(CatalogItemRequest request, CancellationToken ct) =>
        Created(await catalogs.SaveAsync(db.Equipment, null, Input(request), () => new Equipment(), ct));

    [HttpPut("equipment/{id:int}")]
    public async Task<IActionResult> UpdateEquipment(int id, CatalogItemRequest request, CancellationToken ct) =>
        this.ToResponse(await catalogs.SaveAsync(db.Equipment, id, Input(request), () => new Equipment(), ct), NoContent);

    [HttpGet("movement-patterns")]
    public Task<List<CatalogItemResponse>> Patterns(CancellationToken ct) =>
        db.MovementPatterns.OrderBy(p => p.NameEs)
            .Select(p => new CatalogItemResponse(p.Id, p.NameEs, p.NameEn, p.IsActive,
                db.Exercises.Count(x => x.MovementPatternId == p.Id)))
            .ToListAsync(ct);

    [HttpPost("movement-patterns")]
    public async Task<IActionResult> CreatePattern(CatalogItemRequest request, CancellationToken ct) =>
        Created(await catalogs.SaveAsync(db.MovementPatterns, null, Input(request), () => new MovementPattern(), ct));

    [HttpPut("movement-patterns/{id:int}")]
    public async Task<IActionResult> UpdatePattern(int id, CatalogItemRequest request, CancellationToken ct) =>
        this.ToResponse(await catalogs.SaveAsync(db.MovementPatterns, id, Input(request), () => new MovementPattern(), ct), NoContent);

    private static CatalogInput Input(CatalogItemRequest r) => new(r.NameEs, r.NameEn, r.IsActive);

    private IActionResult Created(LibraryResult result) =>
        this.ToResponse(result, () => StatusCode(StatusCodes.Status201Created, new IdResponse(result.Id)));
}
