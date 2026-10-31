using System.Globalization;
using System.Text;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Clients;
using LBMethod.Application.Routines;
using LBMethod.Application.Security;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Clients;
using LBMethod.Domain.Common;
using LBMethod.Domain.Routines;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Exports;

/// <summary>
/// PDF de rutinas y exportaciones a Excel. Todo se arma con datos guardados y pasando por ClientAccess:
/// la entrenadora exporta solo lo suyo y un cliente descarga solo sus rutinas vigentes o programadas.
/// Un recurso ajeno se responde como inexistente (null → 404).
/// </summary>
public class ExportService(IAppDbContext db, ClientAccess access, ICurrentUser user, TimeProvider clock, ITableExporter tables, IRoutinePdfRenderer pdf)
{
    public const string PdfType = "application/pdf";
    public const string XlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static readonly CultureInfo Mx = CultureInfo.GetCultureInfo("es-MX");

    private DateTime NowLocal => BusinessTime.ToLocal(clock.GetUtcNow().UtcDateTime);
    private DateOnly Today => DateOnly.FromDateTime(NowLocal);

    /* ---------- PDF ---------- */

    /// <summary>PDF de una versión de rutina o plantilla propia (sin datos de cliente).</summary>
    public async Task<ExportFile?> RoutineVersionPdfAsync(int routineId, int versionId, CancellationToken ct = default)
    {
        if (!user.IsTrainer) return null;
        var trainerId = user.UserId;
        var version = await VersionQuery().SingleOrDefaultAsync(v => v.Id == versionId && v.RoutineId == routineId && v.Routine.TrainerId == trainerId, ct);
        if (version is null) return null;
        var doc = Document(version, null);
        Audit("RoutinePdfExported", "RoutineVersion", version.Id.ToString(), null);
        await db.SaveChangesAsync(ct);
        return new ExportFile(pdf.Render(doc), PdfType, $"{Slug(version.Title)}-v{version.VersionNumber}.pdf");
    }

    /// <summary>
    /// PDF de una rutina asignada, con el cliente y las fechas del programa. La entrenadora puede descargar cualquier
    /// asignación de sus clientes; el cliente, solo las suyas que estén vigentes o programadas (las mismas que ve en «Mi rutina»).
    /// </summary>
    public async Task<ExportFile?> AssignmentPdfAsync(int assignmentId, CancellationToken ct = default)
    {
        var assignment = await db.RoutineAssignments.AsNoTracking()
            .Where(a => a.Id == assignmentId && access.VisibleClients().Any(c => c.Id == a.ClientId))
            .Include(a => a.Client)
            .SingleOrDefaultAsync(ct);
        if (assignment is null) return null;
        var status = AssignmentState.Effective(assignment.Status, assignment.StartDate, assignment.EndDate, Today);
        if (user.IsClient && !AssignmentState.IsCurrent(status)) return null;

        var version = await VersionQuery().SingleAsync(v => v.Id == assignment.RoutineVersionId, ct);
        var doc = Document(version, assignment) with { AssignmentStatus = ClientLabels.Statuses[status] };
        Audit("AssignmentPdfExported", "RoutineAssignment", assignment.Id.ToString(), assignment.ClientId);
        await db.SaveChangesAsync(ct);
        return new ExportFile(pdf.Render(doc), PdfType, $"{Slug(version.Title)}-{Slug(assignment.Client.FirstName)}.pdf");
    }

    private IQueryable<RoutineVersion> VersionQuery() => db.RoutineVersions.AsNoTracking()
        .Include(v => v.Routine)
        .Include(v => v.Days).ThenInclude(d => d.Exercises).ThenInclude(e => e.Exercise)
        .Include(v => v.Days).ThenInclude(d => d.Exercises).ThenInclude(e => e.SetDetails);

    private RoutineDocument Document(RoutineVersion v, RoutineAssignment? a) => new(
        v.Title, v.VersionNumber, v.Status == RoutineVersionStatus.Draft, v.Description, v.Goal, v.DurationWeeks,
        a is null ? null : $"{a.Client.FirstName} {a.Client.LastName}", a?.StartDate, a?.EndDate, null, a?.Notes, NowLocal,
        v.Days.OrderBy(d => d.Position).Select(d => new RoutineDocumentDay(d.Position, d.Name,
            d.DayOfWeek is { } dow ? RoutineLabels.Days[dow] : null, d.Notes,
            d.Exercises.OrderBy(e => e.Position).Select(e => new RoutineDocumentExercise(
                e.Position, e.Exercise.NameEs, e.Exercise.NameEn, e.SupersetGroup, e.Sets, Reps(e.RepsMin, e.RepsMax),
                Weight(e.SuggestedWeight, e.SuggestedWeightUnit), Rest(e.RestSeconds), e.Tempo, Effort(e.Rir, e.Rpe),
                RoutineLabels.SetTypes[e.SetType], e.Notes,
                e.SetDetails.OrderBy(s => s.SetNumber).Select(s => new RoutineDocumentSet(s.SetNumber, RoutineLabels.SetTypes[s.SetType],
                    Reps(s.RepsMin, s.RepsMax), Weight(s.SuggestedWeight, s.SuggestedWeightUnit), Rest(s.RestSeconds), Effort(s.Rir, s.Rpe), s.Notes)).ToList()
            )).ToList())).ToList());

    /* ---------- Excel ---------- */

    /// <summary>Clientes de la entrenadora con su perfil y el historial de asignaciones. No incluye las notas privadas.</summary>
    public async Task<ExportFile?> ClientsExcelAsync(CancellationToken ct = default)
    {
        if (!user.IsTrainer) return null;
        var clients = await access.VisibleClients().AsNoTracking().OrderBy(c => c.LastName).ThenBy(c => c.FirstName).ToListAsync(ct);
        var ids = clients.Select(c => c.Id).ToList();
        var assignments = await db.RoutineAssignments.AsNoTracking().Where(a => ids.Contains(a.ClientId))
            .Select(a => new { a.ClientId, a.RoutineVersion.Title, a.RoutineVersion.VersionNumber, a.StartDate, a.EndDate, a.Status, a.Notes })
            .ToListAsync(ct);
        var names = clients.ToDictionary(c => c.Id, c => $"{c.FirstName} {c.LastName}");
        var today = Today;

        var clientRows = clients.Select(c =>
        {
            var current = assignments.Where(a => a.ClientId == c.Id && AssignmentState.Effective(a.Status, a.StartDate, a.EndDate, today) == AssignmentStatus.Active)
                .Select(a => a.Title).ToList();
            return new object?[]
            {
                c.FirstName, c.LastName, c.Email, c.Phone, c.Status == ClientStatus.Active ? "Activo" : "Inactivo", c.BirthDate,
                c.Height, c.HeightUnit is { } hu ? (hu == LengthUnit.Cm ? "cm" : "in") : null,
                c.Weight, c.WeightUnit is { } wu ? Unit(wu) : null,
                c.ExperienceLevel is { } lvl ? ClientLabels.Experience[lvl] : null, c.Goal,
                c.TrainingLocation is { } loc ? ClientLabels.Locations[loc] : null, string.Join(", ", ClientLabels.DayNames(c.AvailableDays)),
                c.SessionDurationMinutes, c.DeclaredLimitations, c.UserId is null ? "No" : "Sí",
                current.Count == 0 ? null : string.Join("; ", current), BusinessTime.LocalDate(c.CreatedAt),
            };
        }).ToList();

        var assignmentRows = assignments
            .OrderBy(a => names[a.ClientId]).ThenByDescending(a => a.StartDate)
            .Select(a => new object?[]
            {
                names[a.ClientId], a.Title, a.VersionNumber, a.StartDate, a.EndDate,
                ClientLabels.Statuses[AssignmentState.Effective(a.Status, a.StartDate, a.EndDate, today)], a.Notes,
            }).ToList();

        Audit("ClientsExported", "Client", null, null);
        await db.SaveChangesAsync(ct);
        return Xlsx("clientes", [
            new ExportSheet("Clientes",
                ["Nombre", "Apellidos", "Correo", "Teléfono", "Estado", "Fecha de nacimiento", "Estatura", "Unidad estatura", "Peso", "Unidad peso",
                 "Nivel", "Objetivo", "Lugar de entrenamiento", "Días disponibles", "Duración por sesión (min)", "Limitaciones declaradas",
                 "Tiene cuenta", "Programa vigente", "Registrado"], clientRows),
            new ExportSheet("Asignaciones", ["Cliente", "Rutina", "Versión", "Inicio", "Fin", "Estado", "Indicaciones"], assignmentRows),
        ]);
    }

    /// <summary>Rutinas y plantillas propias: resumen y el detalle de la versión vigente de cada una (la publicada más reciente o, si no hay, el borrador).</summary>
    public async Task<ExportFile?> RoutinesExcelAsync(CancellationToken ct = default)
    {
        if (!user.IsTrainer) return null;
        var trainerId = user.UserId;
        var routines = await db.Routines.AsNoTracking().Where(r => r.TrainerId == trainerId).Include(r => r.Versions)
            .OrderBy(r => r.Kind).ThenBy(r => r.Name).ToListAsync(ct);
        var shown = routines.ToDictionary(r => r.Id, r =>
            r.Versions.Where(v => v.Status == RoutineVersionStatus.Published).MaxBy(v => v.VersionNumber) ?? r.Versions.MaxBy(v => v.VersionNumber));
        var versionIds = shown.Values.Where(v => v is not null).Select(v => v!.Id).ToList();
        var versions = (await VersionQuery().Where(v => versionIds.Contains(v.Id)).ToListAsync(ct)).ToDictionary(v => v.Id);
        var allVersionIds = routines.SelectMany(r => r.Versions).Select(v => v.Id).ToList();
        var assignments = await db.RoutineAssignments.AsNoTracking().Where(a => allVersionIds.Contains(a.RoutineVersionId))
            .Select(a => new { a.RoutineVersion.RoutineId, a.Status, a.StartDate, a.EndDate }).ToListAsync(ct);
        var today = Today;

        var summary = routines.Select(r =>
        {
            var v = shown[r.Id] is { } s ? versions[s.Id] : null;
            var published = r.Versions.Where(x => x.Status == RoutineVersionStatus.Published).MaxBy(x => x.VersionNumber);
            return new object?[]
            {
                r.Name, r.Kind == RoutineKind.Program ? "Programa" : "Plantilla", r.Status == RoutineStatus.Active ? "Activa" : "Archivada",
                published?.VersionNumber, r.Versions.Any(x => x.Status == RoutineVersionStatus.Draft) ? "Sí" : "No",
                v?.Goal, v?.DurationWeeks, v?.Days.Count,
                assignments.Count(a => a.RoutineId == r.Id && AssignmentState.IsCurrent(AssignmentState.Effective(a.Status, a.StartDate, a.EndDate, today))),
                published?.PublishedAt is { } p ? BusinessTime.LocalDate(p) : null,
            };
        }).ToList();

        var detail = new List<object?[]>();
        foreach (var r in routines)
        {
            if (shown[r.Id] is not { } s) continue;
            var v = versions[s.Id];
            foreach (var d in v.Days.OrderBy(d => d.Position))
            foreach (var e in d.Exercises.OrderBy(e => e.Position))
                detail.Add([
                    r.Name, $"v{v.VersionNumber}{(v.Status == RoutineVersionStatus.Draft ? " (borrador)" : "")}", d.Name,
                    d.DayOfWeek is { } dow ? RoutineLabels.Days[dow] : null, e.Position, e.Exercise.NameEs, e.SupersetGroup, e.Sets,
                    Reps(e.RepsMin, e.RepsMax), e.SuggestedWeight, e.SuggestedWeightUnit is { } wu ? Unit(wu) : null, e.RestSeconds, e.Tempo,
                    e.Rir, e.Rpe, RoutineLabels.SetTypes[e.SetType], e.SetDetails.Count > 0 ? SetDetailText(e.SetDetails) : null, e.Notes,
                ]);
        }

        Audit("RoutinesExported", "Routine", null, null);
        await db.SaveChangesAsync(ct);
        return Xlsx("rutinas", [
            new ExportSheet("Rutinas",
                ["Nombre", "Tipo", "Estado", "Versión publicada", "Borrador abierto", "Objetivo", "Semanas", "Días", "Clientes con la rutina vigente o programada", "Publicada el"],
                summary),
            new ExportSheet("Detalle",
                ["Rutina", "Versión", "Día", "Día de la semana", "Orden", "Ejercicio", "Superserie", "Series", "Repeticiones", "Peso sugerido", "Unidad",
                 "Descanso (s)", "Tempo", "RIR", "RPE", "Tipo de serie", "Series detalladas", "Notas"], detail),
        ]);
    }

    /// <summary>Evaluaciones y medidas, de todos los clientes de la entrenadora o de uno. Una fila por medida, con su fecha y unidad.</summary>
    public async Task<ExportFile?> EvaluationsExcelAsync(int? clientId, CancellationToken ct = default)
    {
        if (!user.IsTrainer) return null;
        var clients = access.VisibleClients();
        if (clientId is { } only)
        {
            if (!await clients.AnyAsync(c => c.Id == only, ct)) return null;
            clients = clients.Where(c => c.Id == only);
        }
        var evaluations = await db.Evaluations.AsNoTracking().Where(e => clients.Any(c => c.Id == e.ClientId))
            .Select(e => new
            {
                e.Id, e.EvaluatedOn, e.Notes, e.Client.FirstName, e.Client.LastName,
                Measurements = e.Measurements.OrderBy(m => m.MeasurementType.SortOrder)
                    .Select(m => new { m.MeasurementType.NameEs, m.Value, m.Unit, m.Notes }).ToList(),
            })
            .ToListAsync(ct);

        var rows = new List<object?[]>();
        foreach (var e in evaluations.OrderBy(e => e.LastName).ThenBy(e => e.FirstName).ThenBy(e => e.EvaluatedOn).ThenBy(e => e.Id))
        {
            var name = $"{e.FirstName} {e.LastName}";
            if (e.Measurements.Count == 0) rows.Add([name, e.EvaluatedOn, null, null, null, null, e.Notes]);
            foreach (var m in e.Measurements) rows.Add([name, e.EvaluatedOn, m.NameEs, m.Value, m.Unit, m.Notes, e.Notes]);
        }

        Audit("EvaluationsExported", "Evaluation", null, clientId);
        await db.SaveChangesAsync(ct);
        var suffix = clientId is null ? "" : $"-{Slug(evaluations.FirstOrDefault()?.FirstName ?? "cliente")}";
        return Xlsx($"evaluaciones{suffix}", [
            new ExportSheet("Evaluaciones", ["Cliente", "Fecha", "Medida", "Valor", "Unidad", "Nota de la medida", "Notas de la evaluación"], rows),
        ]);
    }

    /* ---------- Utilidades ---------- */

    private ExportFile Xlsx(string name, IReadOnlyList<ExportSheet> sheets) =>
        new(tables.Build(sheets), XlsxType, $"{name}-lbmethod-{Today:yyyy-MM-dd}.xlsx");

    private void Audit(string action, string entity, string? entityId, int? clientId) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = user.UserId, Action = action, EntityType = entity, EntityId = entityId,
        Details = clientId is null ? null : $"Cliente {clientId}",
    });

    private static string Unit(WeightUnit unit) => unit == WeightUnit.Kg ? "kg" : "lb";

    private static string? Reps(int? min, int? max) => (min, max) switch
    {
        (null, null) => null,
        ({ } a, { } b) when a != b => $"{a}–{b}",
        _ => $"{min ?? max}",
    };

    private static string? Weight(decimal? w, WeightUnit? unit) => w is { } v ? $"{v.ToString("0.##", Mx)} {(unit is { } u ? Unit(u) : "")}".Trim() : null;
    private static string? Rest(int? seconds) => seconds is { } s ? (s >= 60 && s % 60 == 0 ? $"{s / 60} min" : $"{s} s") : null;

    private static string? Effort(decimal? rir, decimal? rpe)
    {
        var parts = new List<string>();
        if (rir is { } a) parts.Add($"RIR {a.ToString("0.#", Mx)}");
        if (rpe is { } b) parts.Add($"RPE {b.ToString("0.#", Mx)}");
        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }

    private static string SetDetailText(IEnumerable<RoutineExerciseSet> sets) => string.Join(" | ", sets.OrderBy(s => s.SetNumber).Select(s =>
        string.Join(" · ", new[] { $"S{s.SetNumber} {RoutineLabels.SetTypes[s.SetType]}", Reps(s.RepsMin, s.RepsMax) is { } r ? $"{r} reps" : null,
            Weight(s.SuggestedWeight, s.SuggestedWeightUnit), Rest(s.RestSeconds), Effort(s.Rir, s.Rpe) }.Where(x => x is not null))));

    /// <summary>Nombre de archivo seguro: sin acentos, espacios ni signos.</summary>
    private static string Slug(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(char.IsAsciiLetterOrDigit(ch) ? char.ToLowerInvariant(ch) : '-');
        }
        var slug = string.Join('-', sb.ToString().Split('-', StringSplitOptions.RemoveEmptyEntries));
        return slug.Length == 0 ? "rutina" : slug[..Math.Min(slug.Length, 60)];
    }
}
