using LBMethod.Api.Contracts;
using LBMethod.Api.Controllers.Trainer.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Library;
using LBMethod.Application.Routines;
using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Routines;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Api.Controllers.Trainer;

/// <summary>
/// Constructor manual de rutinas y plantillas (Kind = Program o Template). Solo la entrenadora dueña
/// puede verlas o modificarlas; cualquier otra devuelve 404. La asignación a clientes llega en la Fase 7.
/// </summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/routines")]
public class RoutinesController(RoutineService routines, IAppDbContext db) : ControllerBase
{
    [HttpGet("options")]
    public RoutineOptionsResponse Options() => new(
        RoutineLabels.SetTypes.Select(s => new OptionResponse((int)s.Key, s.Value)).ToList(),
        RoutineLabels.Days.Select(d => new OptionResponse((int)d.Key, d.Value)).ToList(),
        [new OptionResponse((int)WeightUnit.Kg, "kg"), new OptionResponse((int)WeightUnit.Lb, "lb")]);

    /// <summary>kind: program (predeterminado) o template. status: active (predeterminado) o archived.</summary>
    [HttpGet]
    public async Task<IReadOnlyList<RoutineSummaryResponse>> List([FromQuery] string? kind, [FromQuery] string? status, [FromQuery] string? q, CancellationToken ct)
    {
        var routineKind = kind == "template" ? RoutineKind.Template : RoutineKind.Program;
        var routineStatus = status == "archived" ? RoutineStatus.Archived : RoutineStatus.Active;
        var query = routines.Owned().Where(r => r.Kind == routineKind && r.Status == routineStatus);
        if (NameNormalizer.CleanOptional(q) is { } term) query = query.Where(r => r.Name.Contains(term));

        var rows = await query.OrderByDescending(r => r.UpdatedAt)
            .Select(r => new
            {
                r.Id, r.Kind, r.Name, r.Status, r.UpdatedAt,
                Published = r.Versions.Where(v => v.Status == RoutineVersionStatus.Published).Max(v => (int?)v.VersionNumber),
                HasDraft = r.Versions.Any(v => v.Status == RoutineVersionStatus.Draft),
                // Lo que se ve en la lista corresponde a la versión más reciente (borrador si existe).
                Latest = r.Versions.OrderByDescending(v => v.VersionNumber)
                    .Select(v => new { v.Goal, Days = v.Days.Count, Exercises = v.Days.SelectMany(d => d.Exercises).Count() })
                    .FirstOrDefault()
            })
            .ToListAsync(ct);

        return rows.Select(r => new RoutineSummaryResponse(r.Id, r.Kind.ToString(), r.Name, r.Status.ToString(), r.Latest?.Goal,
            r.Published, r.HasDraft, r.Latest?.Days ?? 0, r.Latest?.Exercises ?? 0, r.UpdatedAt)).ToList();
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateRoutineRequest request, CancellationToken ct)
    {
        var result = await routines.CreateAsync(request.Kind!.Value,
            new RoutineHeaderInput(request.Title, request.Description, request.Goal, request.DurationWeeks), null, ct);
        return this.ToResponse(result, () => CreatedAtAction(nameof(Get), new { id = result.Id }, new IdResponse(result.Id)));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RoutineDetailResponse>> Get(int id, CancellationToken ct)
    {
        var routine = await routines.Owned().AsNoTracking().Include(r => r.Versions).SingleOrDefaultAsync(r => r.Id == id, ct);
        if (routine is null) return NotFound();
        var versions = routine.Versions.OrderByDescending(v => v.VersionNumber).ToList();
        return new RoutineDetailResponse(routine.Id, routine.Kind.ToString(), routine.Name, routine.Status.ToString(), routine.ArchivedAt,
            versions.FirstOrDefault(v => v.Status == RoutineVersionStatus.Draft)?.Id,
            versions.FirstOrDefault(v => v.Status == RoutineVersionStatus.Published)?.Id,
            versions.Select(v => new RoutineVersionSummaryResponse(v.Id, v.VersionNumber, v.Status.ToString(), v.Title, v.PublishedAt, v.ChangeNotes, v.UpdatedAt)).ToList());
    }

    /// <summary>Contenido completo de una versión (borrador o publicada), para editar, revisar o ver la vista previa.</summary>
    [HttpGet("{id:int}/versions/{versionId:int}")]
    public async Task<ActionResult<RoutineVersionResponse>> GetVersion(int id, int versionId, CancellationToken ct)
    {
        var v = await routines.LoadVersionAsync(versionId, ct);
        if (v is null || v.RoutineId != id) return NotFound();

        var exerciseIds = v.Days.SelectMany(d => d.Exercises).Select(e => e.ExerciseId).Distinct().ToList();
        var primary = await db.ExerciseMuscles.Where(m => exerciseIds.Contains(m.ExerciseId) && m.Role == MuscleRole.Primary)
            .Select(m => new { m.ExerciseId, m.MuscleGroup.NameEs }).ToDictionaryAsync(m => m.ExerciseId, m => m.NameEs, ct);

        return new RoutineVersionResponse(v.Id, v.RoutineId, v.Routine.Kind.ToString(), v.VersionNumber, v.Status.ToString(), v.Title,
            v.Description, v.Goal, v.DurationWeeks, v.ChangeNotes, v.PublishedAt, v.SourceVersionId, v.UpdatedAt,
            v.Days.OrderBy(d => d.Position).Select(d => new RoutineDayResponse(d.Id, d.Position, d.Name, (int?)d.DayOfWeek,
                d.DayOfWeek is { } dow ? RoutineLabels.Days[dow] : null, d.Notes,
                d.Exercises.OrderBy(e => e.Position).Select(e => new RoutineExerciseResponse(
                    e.Id, e.Position, e.ExerciseId, e.Exercise.NameEs, e.Exercise.NameEn, e.Exercise.IsActive, primary.GetValueOrDefault(e.ExerciseId),
                    e.SupersetGroup, e.Sets, e.RepsMin, e.RepsMax, e.SuggestedWeight, (int?)e.SuggestedWeightUnit, e.RestSeconds,
                    e.Tempo, e.Rir, e.Rpe, (int)e.SetType, RoutineLabels.SetTypes[e.SetType], e.Notes,
                    e.SetDetails.OrderBy(s => s.SetNumber).Select(s => new RoutineSetResponse(
                        s.SetNumber, (int)s.SetType, RoutineLabels.SetTypes[s.SetType], s.RepsMin, s.RepsMax, s.SuggestedWeight,
                        (int?)s.SuggestedWeightUnit, s.RestSeconds, s.Rir, s.Rpe, s.Notes)).ToList())).ToList())).ToList());
    }

    /// <summary>Abre (o crea a partir de la última versión) el borrador para editar.</summary>
    [HttpPost("{id:int}/draft")]
    public async Task<IActionResult> OpenDraft(int id, CancellationToken ct)
    {
        var result = await routines.OpenDraftAsync(id, ct);
        return this.ToResponse(result, () => Ok(new IdResponse(result.Id)));
    }

    [HttpPut("{id:int}/draft")]
    public async Task<IActionResult> SaveDraft(int id, SaveDraftRequest request, CancellationToken ct)
    {
        var input = new RoutineDraftInput(request.DraftVersionId!.Value,
            new RoutineHeaderInput(request.Title ?? string.Empty, request.Description, request.Goal, request.DurationWeeks),
            (request.Days ?? []).Select(d => new RoutineDayInput(d.Name ?? string.Empty, d.DayOfWeek, d.Notes,
                (d.Exercises ?? []).Select(x => new RoutineExerciseInput(x.ExerciseId, x.SupersetGroup, x.Sets, x.RepsMin, x.RepsMax,
                    x.SuggestedWeight, x.SuggestedWeightUnit, x.RestSeconds, x.Tempo, x.Rir, x.Rpe, x.SetType, x.Notes,
                    (x.SetDetails ?? []).Select(s => new RoutineSetInput(s.SetType, s.RepsMin, s.RepsMax, s.SuggestedWeight,
                        s.SuggestedWeightUnit, s.RestSeconds, s.Rir, s.Rpe, s.Notes)).ToList())).ToList())).ToList());
        return this.ToResponse(await routines.SaveDraftAsync(id, input, ct), NoContent);
    }

    /// <summary>Descarta el borrador (se pide confirmación en pantalla). Las versiones publicadas no se tocan.</summary>
    [HttpDelete("{id:int}/draft")]
    public async Task<IActionResult> DiscardDraft(int id, CancellationToken ct) =>
        this.ToResponse(await routines.DiscardDraftAsync(id, ct), NoContent);

    [HttpPost("{id:int}/publish")]
    public async Task<IActionResult> Publish(int id, PublishRequest request, CancellationToken ct)
    {
        var result = await routines.PublishAsync(id, request.DraftVersionId!.Value, request.ChangeNotes, ct);
        return this.ToResponse(result, () => Ok(new IdResponse(result.Id)));
    }

    /// <summary>
    /// Copia una versión en una rutina nueva. Sirve para duplicar, guardar como plantilla y crear desde plantilla.
    /// Si no se indica versión, se usa el borrador o, si no hay, la última versión publicada.
    /// </summary>
    [HttpPost("{id:int}/copy")]
    public async Task<IActionResult> Copy(int id, CopyRoutineRequest request, CancellationToken ct)
    {
        var versions = routines.Owned().Where(r => r.Id == id).SelectMany(r => r.Versions);
        var sourceId = request.VersionId is { } vid
            ? await versions.Where(v => v.Id == vid).Select(v => (int?)v.Id).SingleOrDefaultAsync(ct)
            : await versions.OrderByDescending(v => v.VersionNumber).Select(v => (int?)v.Id).FirstOrDefaultAsync(ct);
        if (sourceId is null) return NotFound();
        var result = await routines.CopyAsync(sourceId.Value, request.Kind!.Value, request.Title, ct);
        return this.ToResponse(result, () => CreatedAtAction(nameof(Get), new { id = result.Id }, new IdResponse(result.Id)));
    }

    [HttpPost("{id:int}/archive")]
    public async Task<IActionResult> Archive(int id, CancellationToken ct) =>
        this.ToResponse(await routines.SetArchivedAsync(id, true, ct), NoContent);

    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> Restore(int id, CancellationToken ct) =>
        this.ToResponse(await routines.SetArchivedAsync(id, false, ct), NoContent);
}
