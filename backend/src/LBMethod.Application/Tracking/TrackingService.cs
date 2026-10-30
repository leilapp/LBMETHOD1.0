using LBMethod.Application.Abstractions;
using LBMethod.Application.Library;
using LBMethod.Application.Security;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Calendar;
using LBMethod.Domain.Common;
using LBMethod.Domain.Files;
using LBMethod.Domain.Tracking;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Tracking;

public record PhotoContent(Stream Content, string ContentType);

/// <summary>
/// Seguimiento que registra la entrenadora: tipos de medida, evaluaciones con sus medidas y fotos de progreso privadas.
/// Nada se borra: una medida mal capturada se corrige y la corrección queda en la bitácora.
/// </summary>
public class TrackingService(IAppDbContext db, IFileStorage storage, ICurrentUser user, ClientAccess access, TrackingLimits limits, TimeProvider clock)
{
    public const int MaxNotes = 1000;
    public const int MaxEvaluationNotes = 2000;
    public const int MaxMeasurementsPerEvaluation = 40;

    public DateOnly Today() => BusinessTime.LocalDate(clock.GetUtcNow().UtcDateTime);

    // ---------- Tipos de medida ----------

    public async Task<LibraryResult> CreateTypeAsync(MeasurementTypeInput input, CancellationToken ct = default)
    {
        var errors = ValidateType(input);
        if (errors.Count > 0) return LibraryResult.Invalid(errors);
        var nameEs = NameNormalizer.Clean(input.NameEs);
        var nameEn = string.IsNullOrWhiteSpace(input.NameEn) ? nameEs : NameNormalizer.Clean(input.NameEn);
        if (await db.MeasurementTypes.AnyAsync(t => t.NameEs == nameEs, ct)) return LibraryResult.Duplicate("nameEs", "Ya existe un tipo de medida con ese nombre.");
        if (await db.MeasurementTypes.AnyAsync(t => t.NameEn == nameEn, ct)) return LibraryResult.Duplicate("nameEn", "Ya existe un tipo de medida con ese nombre en inglés.");

        var order = await db.MeasurementTypes.Select(t => (int?)t.SortOrder).MaxAsync(ct) ?? 0;
        var type = new MeasurementType { NameEs = nameEs, NameEn = nameEn, Kind = input.Kind, Unit = input.Unit, SortOrder = order + 1, IsActive = input.IsActive };
        db.MeasurementTypes.Add(type);
        await db.SaveChangesAsync(ct);
        Audit("MeasurementTypeCreated", nameof(MeasurementType), type.Id, $"{nameEs} ({input.Unit})");
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(type.Id);
    }

    /// <summary>Edita nombre y estado. La unidad y el tipo solo cambian si aún no hay medidas, para no mezclar unidades en el historial.</summary>
    public async Task<LibraryResult> UpdateTypeAsync(int id, MeasurementTypeInput input, CancellationToken ct = default)
    {
        var type = await db.MeasurementTypes.SingleOrDefaultAsync(t => t.Id == id, ct);
        if (type is null) return LibraryResult.NotFound();
        var errors = ValidateType(input);
        if (errors.Count > 0) return LibraryResult.Invalid(errors);
        var nameEs = NameNormalizer.Clean(input.NameEs);
        var nameEn = string.IsNullOrWhiteSpace(input.NameEn) ? nameEs : NameNormalizer.Clean(input.NameEn);
        if (await db.MeasurementTypes.AnyAsync(t => t.Id != id && t.NameEs == nameEs, ct)) return LibraryResult.Duplicate("nameEs", "Ya existe un tipo de medida con ese nombre.");
        if (await db.MeasurementTypes.AnyAsync(t => t.Id != id && t.NameEn == nameEn, ct)) return LibraryResult.Duplicate("nameEn", "Ya existe un tipo de medida con ese nombre en inglés.");
        if ((type.Unit != input.Unit || type.Kind != input.Kind) && await db.Measurements.AnyAsync(m => m.MeasurementTypeId == id, ct))
            return LibraryResult.Invalid("unit", "Ya hay medidas registradas con este tipo y unidad. Para usar otra unidad, crea un tipo nuevo; así el historial no mezcla unidades.");

        type.NameEs = nameEs;
        type.NameEn = nameEn;
        type.Kind = input.Kind;
        type.Unit = input.Unit;
        type.IsActive = input.IsActive;
        Audit("MeasurementTypeUpdated", nameof(MeasurementType), id, $"{nameEs} ({input.Unit}){(input.IsActive ? "" : " inactivo")}");
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(id);
    }

    private static Dictionary<string, List<string>> ValidateType(MeasurementTypeInput input)
    {
        var errors = new Dictionary<string, List<string>>();
        void Add(string f, string m) => (errors.TryGetValue(f, out var l) ? l : errors[f] = []).Add(m);
        if (string.IsNullOrWhiteSpace(input.NameEs)) Add("nameEs", "Escribe el nombre.");
        else if (input.NameEs.Trim().Length > 100) Add("nameEs", "Máximo 100 caracteres.");
        if (input.NameEn is { Length: > 100 }) Add("nameEn", "Máximo 100 caracteres.");
        if (!TrackingLabels.UnitsByKind.TryGetValue(input.Kind, out var units)) Add("kind", "Elige el tipo de medida.");
        else if (!units.Contains(input.Unit)) Add("unit", $"Para «{TrackingLabels.Kinds[input.Kind]}» la unidad debe ser {string.Join(", ", units)}.");
        return errors;
    }

    // ---------- Evaluaciones y medidas ----------

    public async Task<LibraryResult> CreateEvaluationAsync(int clientId, EvaluationInput input, CancellationToken ct = default)
    {
        if (!await access.TrainerOwnsClientAsync(clientId, ct)) return LibraryResult.NotFound();
        var types = await db.MeasurementTypes.ToDictionaryAsync(t => t.Id, ct);
        var errors = ValidateEvaluation(input, types, requireActive: true);
        if (input.Measurements.Count == 0 && string.IsNullOrWhiteSpace(input.Notes))
            (errors.TryGetValue("measurements", out var l) ? l : errors["measurements"] = []).Add("Registra al menos una medida o escribe una nota.");
        if (errors.Count > 0) return LibraryResult.Invalid(errors);

        var evaluation = new Evaluation
        {
            ClientId = clientId, EvaluatedOn = input.EvaluatedOn!.Value, PerformedByUserId = user.UserId, Notes = NameNormalizer.CleanOptional(input.Notes)
        };
        foreach (var m in input.Measurements)
            evaluation.Measurements.Add(NewMeasurement(clientId, evaluation.EvaluatedOn, types[m.MeasurementTypeId], m));

        return await db.InTransactionAsync(async () =>
        {
            db.Evaluations.Add(evaluation);
            await db.SaveChangesAsync(ct);
            // Si había una evaluación programada para ese día, queda como hecha y enlazada.
            var planned = await db.CalendarEvents.Where(e => e.ClientId == clientId && e.Date == evaluation.EvaluatedOn &&
                e.Type == CalendarEventType.Evaluation && e.Status == CalendarEventStatus.Planned).ToListAsync(ct);
            foreach (var e in planned)
            {
                e.Status = CalendarEventStatus.Completed;
                e.EvaluationId = evaluation.Id;
            }
            Audit("EvaluationCreated", nameof(Evaluation), evaluation.Id, $"Cliente {clientId}, {evaluation.EvaluatedOn:yyyy-MM-dd}, {evaluation.Measurements.Count} medidas");
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(evaluation.Id);
        }, ct);
    }

    /// <summary>Cambia la fecha o las notas y agrega medidas nuevas. Las medidas existentes se corrigen una por una.</summary>
    public async Task<LibraryResult> UpdateEvaluationAsync(int evaluationId, EvaluationInput input, CancellationToken ct = default)
    {
        var evaluation = await OwnedEvaluations().Include(e => e.Measurements).SingleOrDefaultAsync(e => e.Id == evaluationId, ct);
        if (evaluation is null) return LibraryResult.NotFound();
        var types = await db.MeasurementTypes.ToDictionaryAsync(t => t.Id, ct);
        var errors = ValidateEvaluation(input, types, requireActive: true);
        for (var i = 0; i < input.Measurements.Count; i++)
            if (evaluation.Measurements.Any(m => m.MeasurementTypeId == input.Measurements[i].MeasurementTypeId))
                (errors.TryGetValue($"measurements[{i}].measurementTypeId", out var l) ? l : errors[$"measurements[{i}].measurementTypeId"] = [])
                    .Add("Esta medida ya está en la evaluación; corrígela en lugar de agregarla otra vez.");
        if (errors.Count > 0) return LibraryResult.Invalid(errors);

        var changes = new List<string>();
        if (evaluation.EvaluatedOn != input.EvaluatedOn!.Value)
        {
            changes.Add($"fecha {evaluation.EvaluatedOn:yyyy-MM-dd} → {input.EvaluatedOn:yyyy-MM-dd}");
            evaluation.EvaluatedOn = input.EvaluatedOn.Value;
            foreach (var m in evaluation.Measurements) m.MeasuredOn = evaluation.EvaluatedOn;
        }
        var notes = NameNormalizer.CleanOptional(input.Notes);
        if (notes != evaluation.Notes)
        {
            changes.Add("notas");
            evaluation.Notes = notes;
        }
        foreach (var m in input.Measurements)
        {
            evaluation.Measurements.Add(NewMeasurement(evaluation.ClientId, evaluation.EvaluatedOn, types[m.MeasurementTypeId], m));
            changes.Add($"nueva medida {types[m.MeasurementTypeId].NameEs}");
        }
        if (changes.Count > 0) Audit("EvaluationUpdated", nameof(Evaluation), evaluationId, string.Join("; ", changes));
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(evaluationId);
    }

    /// <summary>Corrige el valor o la nota de una medida. El valor anterior queda registrado en la bitácora.</summary>
    public async Task<LibraryResult> CorrectMeasurementAsync(int measurementId, decimal? value, string? notes, CancellationToken ct = default)
    {
        var userId = user.UserId;
        var m = await db.Measurements.SingleOrDefaultAsync(x => x.Id == measurementId && x.Client.TrainerId == userId, ct);
        if (m is null) return LibraryResult.NotFound();
        var errors = new Dictionary<string, List<string>>();
        ValidateValue(errors, "value", value, m.Unit);
        if (notes is { Length: > MaxNotes }) errors["notes"] = [$"Máximo {MaxNotes} caracteres."];
        if (errors.Count > 0) return LibraryResult.Invalid(errors);

        var before = m.Value;
        m.Value = value!.Value;
        m.Notes = NameNormalizer.CleanOptional(notes);
        Audit("MeasurementCorrected", nameof(Measurement), m.Id, $"{before} {m.Unit} → {m.Value} {m.Unit}");
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(m.Id);
    }

    private IQueryable<Evaluation> OwnedEvaluations()
    {
        var userId = user.UserId;
        return db.Evaluations.Where(e => e.Client.TrainerId == userId);
    }

    private Measurement NewMeasurement(int clientId, DateOnly date, MeasurementType type, MeasurementInput m) => new()
    {
        ClientId = clientId, MeasurementTypeId = type.Id, MeasuredOn = date, Value = m.Value!.Value,
        Unit = type.Unit, RecordedByUserId = user.UserId, Notes = NameNormalizer.CleanOptional(m.Notes)
    };

    private Dictionary<string, List<string>> ValidateEvaluation(EvaluationInput input, Dictionary<int, MeasurementType> types, bool requireActive)
    {
        var errors = new Dictionary<string, List<string>>();
        void Add(string f, string m) => (errors.TryGetValue(f, out var l) ? l : errors[f] = []).Add(m);
        if (input.EvaluatedOn is not { } date) Add("evaluatedOn", "Indica la fecha de la evaluación.");
        else if (date > Today()) Add("evaluatedOn", "La fecha no puede ser futura.");
        else if (date.Year < 2000) Add("evaluatedOn", "Fecha no válida.");
        if (input.Notes is { Length: > MaxEvaluationNotes }) Add("notes", $"Máximo {MaxEvaluationNotes} caracteres.");
        if (input.Measurements.Count > MaxMeasurementsPerEvaluation) Add("measurements", $"Máximo {MaxMeasurementsPerEvaluation} medidas por evaluación.");

        var seen = new HashSet<int>();
        for (var i = 0; i < input.Measurements.Count; i++)
        {
            var m = input.Measurements[i];
            var key = $"measurements[{i}]";
            if (!types.TryGetValue(m.MeasurementTypeId, out var type) || (requireActive && !type.IsActive))
            {
                Add($"{key}.measurementTypeId", "Elige un tipo de medida activo.");
                continue;
            }
            if (!seen.Add(m.MeasurementTypeId)) Add($"{key}.measurementTypeId", "Esta medida está repetida.");
            ValidateValue(errors, $"{key}.value", m.Value, type.Unit);
            if (m.Notes is { Length: > MaxNotes }) Add($"{key}.notes", $"Máximo {MaxNotes} caracteres.");
        }
        return errors;
    }

    private static void ValidateValue(Dictionary<string, List<string>> errors, string field, decimal? value, string unit)
    {
        string? message = null;
        if (value is not { } v) message = "Escribe el valor.";
        else if (decimal.Round(v, 2) != v) message = "Máximo dos decimales.";
        else if (TrackingLabels.Ranges.TryGetValue(unit, out var r) ? v < r.Min || v > r.Max : v <= 0 || v > 99999m)
            message = TrackingLabels.Ranges.TryGetValue(unit, out var range) ? $"Debe estar entre {range.Min} y {range.Max} {unit}." : "Valor fuera de rango.";
        if (message is not null) (errors.TryGetValue(field, out var l) ? l : errors[field] = []).Add(message);
    }

    // ---------- Fotos de progreso ----------

    private static readonly (string ContentType, string Extension, Func<byte[], bool> Matches)[] PhotoSignatures =
    [
        ("image/jpeg", ".jpg", b => b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF),
        ("image/png", ".png", b => b.Length >= 8 && b[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })),
        ("image/webp", ".webp", b => b.Length >= 12 && b[..4].SequenceEqual("RIFF"u8.ToArray()) && b[8..12].SequenceEqual("WEBP"u8.ToArray())),
    ];

    public async Task<LibraryResult> UploadPhotoAsync(int clientId, Stream content, long length, PhotoInput input, CancellationToken ct = default)
    {
        if (!await access.TrainerOwnsClientAsync(clientId, ct)) return LibraryResult.NotFound();
        var errors = new Dictionary<string, List<string>>();
        void Add(string f, string m) => (errors.TryGetValue(f, out var l) ? l : errors[f] = []).Add(m);
        if (input.TakenOn is not { } date) Add("takenOn", "Indica la fecha de la foto.");
        else if (date > Today()) Add("takenOn", "La fecha no puede ser futura.");
        if (input.Category is { } c && !Enum.IsDefined(c)) Add("category", "Categoría no válida.");
        if (input.Notes is { Length: > MaxNotes }) Add("notes", $"Máximo {MaxNotes} caracteres.");
        if (input.EvaluationId is { } evId && !await db.Evaluations.AnyAsync(e => e.Id == evId && e.ClientId == clientId, ct))
            Add("evaluationId", "La evaluación no es de este cliente.");
        if (length <= 0) Add("file", "Selecciona una foto.");
        else if (length > limits.MaxPhotoBytes) Add("file", $"La foto supera el máximo de {limits.MaxPhotoBytes / (1024 * 1024)} MB.");
        if (errors.Count > 0) return LibraryResult.Invalid(errors);

        var header = new byte[16];
        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        var signature = PhotoSignatures.FirstOrDefault(s => s.Matches(header[..read]));
        if (signature.ContentType is null) return LibraryResult.Invalid("file", "Formato no permitido. Usa una foto JPG, PNG o WEBP.");
        content.Position = 0;

        var file = new StoredFile
        {
            Id = Guid.NewGuid(), Purpose = FilePurpose.ProgressPhoto, OwnerClientId = clientId, UploadedByUserId = user.UserId,
            OriginalFileName = $"progreso-{input.TakenOn:yyyy-MM-dd}{signature.Extension}", ContentType = signature.ContentType,
            SizeBytes = length, StorageProvider = storage.ProviderName, CreatedAt = clock.GetUtcNow().UtcDateTime,
        };
        file.StorageKey = $"progress/{file.Id:N}{signature.Extension}";
        await storage.SaveAsync(file.StorageKey, content, ct);
        try
        {
            var photo = new ProgressPhoto
            {
                ClientId = clientId, StoredFile = file, EvaluationId = input.EvaluationId, TakenOn = input.TakenOn!.Value,
                Category = input.Category, Notes = NameNormalizer.CleanOptional(input.Notes)
            };
            db.ProgressPhotos.Add(photo);
            await db.SaveChangesAsync(ct);
            Audit("ProgressPhotoUploaded", nameof(ProgressPhoto), photo.Id, $"Cliente {clientId}");
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(photo.Id);
        }
        catch
        {
            await storage.DeleteAsync(file.StorageKey, ct); // no dejar archivos huérfanos
            throw;
        }
    }

    /// <summary>Abre una foto solo si el usuario actual puede ver al cliente dueño (su entrenadora o el propio cliente).</summary>
    public async Task<PhotoContent?> OpenPhotoAsync(int photoId, CancellationToken ct = default)
    {
        var visible = access.VisibleClients().Select(c => c.Id);
        var file = await db.ProgressPhotos.Where(p => p.Id == photoId && visible.Contains(p.ClientId) && p.StoredFile.DeletedAt == null)
            .Select(p => p.StoredFile).SingleOrDefaultAsync(ct);
        if (file is null) return null;
        var stream = await storage.OpenReadAsync(file.StorageKey, ct);
        return stream is null ? null : new PhotoContent(stream, file.ContentType);
    }

    private void Audit(string action, string entity, int id, string? details) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = user.UserId, Action = action, EntityType = entity, EntityId = id.ToString(), Details = details
    });
}
