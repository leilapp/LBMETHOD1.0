using System.Net.Mail;
using LBMethod.Application.Abstractions;
using LBMethod.Application.Accounts;
using LBMethod.Application.Library;
using LBMethod.Application.Security;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Clients;
using LBMethod.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Clients;

/// <summary>
/// Perfil del cliente y observaciones privadas de la entrenadora. Solo la entrenadora dueña del cliente
/// puede modificarlo. Nada se borra: desactivar un cliente conserva entrenamientos, medidas y asignaciones.
/// </summary>
public class ClientService(IAppDbContext db, ClientAccess access, IAccountService accounts, ICurrentUser user, TimeProvider clock)
{
    public async Task<LibraryResult> UpdateProfileAsync(int clientId, ClientProfileInput input, CancellationToken ct = default)
    {
        var client = await access.VisibleClients().SingleOrDefaultAsync(c => c.Id == clientId, ct);
        if (client is null || !user.IsTrainer) return LibraryResult.NotFound();

        var errors = Validate(input, BusinessTime.LocalDate(clock.GetUtcNow().UtcDateTime));
        if (errors.Count > 0) return LibraryResult.Invalid(errors);

        var email = input.Email.Trim();
        var emailChanged = !string.Equals(email, client.Email, StringComparison.OrdinalIgnoreCase);
        if (emailChanged && await db.Clients.AnyAsync(c => c.Id != clientId && c.Email == email, ct))
            return LibraryResult.Duplicate("email", "Ya existe una cuenta con ese correo.");

        return await db.InTransactionAsync(async () =>
        {
            // El correo es el usuario para entrar: si cambia, se cambia también en la cuenta.
            if (client.UserId is not null && email != client.Email)
            {
                var changed = await accounts.ChangeClientEmailAsync(user.UserId, clientId, email, ct);
                if (changed.Error == AccountError.EmailInUse) return LibraryResult.Duplicate("email", "Ya existe una cuenta con ese correo.");
                if (!changed.Succeeded) return LibraryResult.Invalid("email", string.Join(" ", changed.Messages ?? ["Correo no válido."]));
            }

            client.FirstName = input.FirstName.Trim();
            client.LastName = input.LastName.Trim();
            client.Email = email;
            client.Phone = Opt(input.Phone);
            client.BirthDate = input.BirthDate;
            client.Height = input.Height;
            client.HeightUnit = input.Height is null ? null : input.HeightUnit;
            client.Weight = input.Weight;
            client.WeightUnit = input.Weight is null ? null : input.WeightUnit;
            client.ExperienceLevel = input.ExperienceLevel;
            client.Goal = Opt(input.Goal);
            client.TrainingLocation = input.TrainingLocation;
            client.AvailableDays = input.AvailableDays;
            client.SessionDurationMinutes = input.SessionDurationMinutes;
            client.DeclaredLimitations = Opt(input.DeclaredLimitations);
            Audit("ClientProfileUpdated", clientId, emailChanged ? "correo cambiado" : null);
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(clientId);
        }, ct);
    }

    /// <summary>Agrega una observación privada. Nunca se muestra al cliente.</summary>
    public async Task<LibraryResult> AddNoteAsync(int clientId, string? content, CancellationToken ct = default)
    {
        if (!user.IsTrainer || !await access.TrainerOwnsClientAsync(clientId, ct)) return LibraryResult.NotFound();
        var text = content?.Trim() ?? string.Empty;
        if (text.Length == 0) return LibraryResult.Invalid("content", "Escribe la observación.");
        if (text.Length > ClientLimits.MaxNoteLength) return LibraryResult.Invalid("content", $"Máximo {ClientLimits.MaxNoteLength} caracteres.");

        var note = new ClientNote { ClientId = clientId, AuthorUserId = user.UserId, Content = text };
        db.ClientNotes.Add(note);
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(note.Id);
    }

    internal static Dictionary<string, List<string>> Validate(ClientProfileInput i, DateOnly today)
    {
        var errors = new Dictionary<string, List<string>>();
        void Add(string field, string message) => (errors.TryGetValue(field, out var l) ? l : errors[field] = []).Add(message);

        if (string.IsNullOrWhiteSpace(i.FirstName)) Add("firstName", "Escribe el nombre.");
        else if (i.FirstName.Trim().Length > 100) Add("firstName", "Máximo 100 caracteres.");
        if (string.IsNullOrWhiteSpace(i.LastName)) Add("lastName", "Escribe los apellidos.");
        else if (i.LastName.Trim().Length > 100) Add("lastName", "Máximo 100 caracteres.");
        if (!IsEmail(i.Email)) Add("email", "Escribe un correo válido.");
        if (i.Phone is { Length: > 0 } phone && (phone.Trim().Length > 30 || phone.Any(ch => !(char.IsDigit(ch) || " +-()".Contains(ch)))))
            Add("phone", "Teléfono no válido.");

        if (i.BirthDate is { } birth && (birth > today || birth < today.AddYears(-110)))
            Add("birthDate", "Fecha de nacimiento no válida.");

        if (i.Height is { } h)
        {
            if (i.HeightUnit is not { } hu || !Enum.IsDefined(hu)) Add("heightUnit", "Elige la unidad.");
            else if (hu == LengthUnit.Cm ? h is < 50 or > 250 : h is < 20 or > 100) Add("height", hu == LengthUnit.Cm ? "Entre 50 y 250 cm." : "Entre 20 y 100 in.");
        }
        if (i.Weight is { } w)
        {
            if (i.WeightUnit is not { } wu || !Enum.IsDefined(wu)) Add("weightUnit", "Elige la unidad.");
            else if (wu == WeightUnit.Kg ? w is < 20 or > 400 : w is < 44 or > 880) Add("weight", wu == WeightUnit.Kg ? "Entre 20 y 400 kg." : "Entre 44 y 880 lb.");
        }

        if (i.ExperienceLevel is { } e && !Enum.IsDefined(e)) Add("experienceLevel", "Nivel no válido.");
        if (i.TrainingLocation is { } loc && !Enum.IsDefined(loc)) Add("trainingLocation", "Lugar no válido.");
        if ((int)i.AvailableDays is < 0 or > 127) Add("availableDays", "Días no válidos.");
        if (i.SessionDurationMinutes is { } d && d is < 10 or > 300) Add("sessionDurationMinutes", "Entre 10 y 300 minutos.");
        if (i.Goal is { Length: > 500 }) Add("goal", "Máximo 500 caracteres.");
        if (i.DeclaredLimitations is { Length: > 2000 }) Add("declaredLimitations", "Máximo 2000 caracteres.");
        return errors;
    }

    private static bool IsEmail(string? value)
    {
        var v = value?.Trim() ?? string.Empty;
        if (v.Length is 0 or > 256 || v.Contains(' ')) return false;
        return MailAddress.TryCreate(v, out var parsed) && parsed.Address == v && v.Contains('.', StringComparison.Ordinal);
    }

    private static string? Opt(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private void Audit(string action, int clientId, string? details) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = user.UserId, Action = action,
        EntityType = nameof(Client), EntityId = clientId.ToString(), Details = details
    });
}
