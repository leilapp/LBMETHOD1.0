using LBMethod.Api.Contracts;
using LBMethod.Api.Controllers.Trainer.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Clients;
using LBMethod.Application.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LBMethod.Api.Controllers.Trainer;

[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/assignments")]
public class AssignmentsController(AssignmentService assignments, IAppDbContext db) : ControllerBase
{
    /// <summary>Asigna una versión publicada a uno o varios clientes.</summary>
    [HttpPost]
    public async Task<IActionResult> Create(CreateAssignmentRequest r, CancellationToken ct)
    {
        if (r.RoutineVersionId is null) return this.ToResponse(LibraryResult.Invalid("routineVersionId", "Elige la rutina y su versión."), NoContent);
        if (r.StartDate is null) return this.ToResponse(LibraryResult.Invalid("startDate", "Indica la fecha de inicio."), NoContent);
        var result = await assignments.AssignAsync(
            new AssignmentInput(r.ClientIds ?? [], r.RoutineVersionId.Value, r.StartDate.Value, r.EndDate, r.Notes), ct);
        return this.ToResponse(result.Result, () => StatusCode(StatusCodes.Status201Created, new AssignmentCreatedResponse(result.Ids)));
    }

    [HttpPost("{id:int}/end-date")]
    public async Task<IActionResult> SetEndDate(int id, SetEndDateRequest r, CancellationToken ct)
    {
        if (r.EndDate is null) return this.ToResponse(LibraryResult.Invalid("endDate", "Indica la fecha de fin."), NoContent);
        return this.ToResponse(await assignments.SetEndDateAsync(id, r.EndDate.Value, ct), NoContent);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct) =>
        this.ToResponse(await assignments.CancelAsync(id, ct), NoContent);

    /// <summary>Clientes que tienen (o tuvieron) asignada esta rutina, en cualquiera de sus versiones.</summary>
    [HttpGet("~/api/trainer/routines/{routineId:int}/assignments")]
    public async Task<IReadOnlyList<AssignmentResponse>> ByRoutine(int routineId, CancellationToken ct) =>
        await assignments.Owned().Where(a => a.RoutineVersion.RoutineId == routineId).ToResponsesAsync(db, assignments.Today(), ct);
}
