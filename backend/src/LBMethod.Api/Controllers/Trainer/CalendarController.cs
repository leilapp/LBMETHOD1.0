using LBMethod.Api.Contracts;
using LBMethod.Api.Controllers.Trainer.Library;
using LBMethod.Api.Security;
using LBMethod.Application.Library;
using LBMethod.Application.Tracking;
using LBMethod.Domain.Calendar;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LBMethod.Api.Controllers.Trainer;

/// <summary>Calendario de la entrenadora: de todos sus clientes o de uno, y eventos que ella crea (nunca se borran, se cancelan).</summary>
[ApiController]
[Authorize(Policy = Policies.Trainer)]
[Route("api/trainer/calendar")]
public class CalendarController(CalendarService calendar) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] int? clientId, CancellationToken ct)
    {
        if (CalendarRange.Check(from, to) is { } invalid) return this.ToResponse(invalid, NoContent);
        var items = await calendar.BuildAsync(from!.Value, to!.Value, clientId, ct);
        return items is null ? NotFound() : Ok(items);
    }

    [HttpPost("events")]
    public async Task<IActionResult> Create(CalendarEventRequest r, CancellationToken ct)
    {
        var result = await calendar.CreateAsync(Input(r), ct);
        return this.ToResponse(result, () => StatusCode(StatusCodes.Status201Created, new IdResponse(result.Id)));
    }

    [HttpPut("events/{id:int}")]
    public async Task<IActionResult> Update(int id, CalendarEventRequest r, CancellationToken ct) =>
        this.ToResponse(await calendar.UpdateAsync(id, Input(r), ct), NoContent);

    [HttpPost("events/{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, EventStatusRequest r, CancellationToken ct) =>
        this.ToResponse(await calendar.SetStatusAsync(id, (CalendarEventStatus)(r.Status ?? 0), ct), NoContent);

    private static CalendarEventInput Input(CalendarEventRequest r) =>
        new(r.ClientId, (CalendarEventType)(r.Type ?? 0), r.Title, r.Date, r.StartTime, r.EndTime, r.Notes);
}

internal static class CalendarRange
{
    public static LibraryResult? Check(DateOnly? from, DateOnly? to)
    {
        if (from is null || to is null) return LibraryResult.Invalid("from", "Indica el rango de fechas.");
        if (to < from) return LibraryResult.Invalid("to", "La fecha final no puede ser anterior a la inicial.");
        if (to.Value.DayNumber - from.Value.DayNumber > CalendarService.MaxRangeDays)
            return LibraryResult.Invalid("to", $"Máximo {CalendarService.MaxRangeDays} días por consulta.");
        return null;
    }
}
