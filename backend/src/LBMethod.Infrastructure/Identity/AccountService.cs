using System.Security.Cryptography;
using LBMethod.Application.Accounts;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Clients;
using LBMethod.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Infrastructure.Identity;

public class AccountService(LBMethodDbContext db, UserManager<AppUser> users, TimeProvider clock) : IAccountService
{
    public async Task<TemporaryPasswordResult> CreateClientAccountAsync(int trainerId, NewClientAccount data, CancellationToken ct = default)
    {
        var email = data.Email.Trim();
        if (await users.FindByEmailAsync(email) is not null || await db.Clients.AnyAsync(c => c.Email == email, ct))
            return new TemporaryPasswordResult(AccountError.EmailInUse);

        var password = TemporaryPassword.Generate();
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var user = new AppUser
            {
                UserName = email, Email = email, DisplayName = $"{data.FirstName} {data.LastName}".Trim(),
                MustChangePassword = true, LockoutEnabled = true
            };
            var created = await users.CreateAsync(user, password);
            if (!created.Succeeded)
                return new TemporaryPasswordResult(AccountError.InvalidData, Messages: Errors(created));
            await users.AddToRoleAsync(user, Roles.Client);

            var client = new Client
            {
                TrainerId = trainerId, UserId = user.Id, FirstName = data.FirstName.Trim(), LastName = data.LastName.Trim(),
                Email = email, Phone = data.Phone?.Trim()
            };
            db.Clients.Add(client);
            await db.SaveChangesAsync(ct);
            Audit(trainerId, "ClientAccountCreated", client.Id);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return new TemporaryPasswordResult(AccountError.None, client.Id, password);
        });
    }

    public async Task<TemporaryPasswordResult> ResetClientPasswordAsync(int trainerId, int clientId, CancellationToken ct = default)
    {
        var user = await FindClientUserAsync(trainerId, clientId, ct);
        if (user is null) return new TemporaryPasswordResult(AccountError.NotFound);

        var password = TemporaryPassword.Generate();
        var token = await users.GeneratePasswordResetTokenAsync(user);
        var reset = await users.ResetPasswordAsync(user, token, password);
        if (!reset.Succeeded) return new TemporaryPasswordResult(AccountError.InvalidData, Messages: Errors(reset));

        user.MustChangePassword = true;
        await users.UpdateAsync(user);
        // Cierra cualquier sesión abierta y desbloquea la cuenta si estaba bloqueada por intentos fallidos.
        await users.UpdateSecurityStampAsync(user);
        await users.SetLockoutEndDateAsync(user, null);
        await users.ResetAccessFailedCountAsync(user);
        Audit(trainerId, "ClientPasswordReset", clientId);
        await db.SaveChangesAsync(ct);
        return new TemporaryPasswordResult(AccountError.None, clientId, password);
    }

    public async Task<AccountResult> SetClientAccessAsync(int trainerId, int clientId, bool enabled, CancellationToken ct = default)
    {
        var user = await FindClientUserAsync(trainerId, clientId, ct);
        if (user is null) return new AccountResult(AccountError.NotFound);

        user.IsActive = enabled;
        await users.UpdateAsync(user);
        // El estado del perfil acompaña al acceso; desactivar nunca borra datos.
        var client = await db.Clients.SingleAsync(c => c.Id == clientId, ct);
        client.Status = enabled ? ClientStatus.Active : ClientStatus.Inactive;
        client.DeactivatedAt = enabled ? null : clock.GetUtcNow().UtcDateTime;
        if (!enabled) await users.UpdateSecurityStampAsync(user); // cierra sesiones abiertas
        Audit(trainerId, enabled ? "ClientAccessEnabled" : "ClientAccessDisabled", clientId);
        await db.SaveChangesAsync(ct);
        return AccountResult.Ok();
    }

    public async Task<AccountResult> CreateTrainerAsync(string email, string displayName, string password, CancellationToken ct = default)
    {
        if (await users.FindByEmailAsync(email) is not null) return new AccountResult(AccountError.EmailInUse);
        var user = new AppUser { UserName = email, Email = email, DisplayName = displayName, LockoutEnabled = true };
        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded) return new AccountResult(AccountError.InvalidData, Errors(created));
        await users.AddToRoleAsync(user, Roles.Trainer);
        Audit(user.Id, "TrainerCreated", null);
        await db.SaveChangesAsync(ct);
        return AccountResult.Ok();
    }

    private async Task<AppUser?> FindClientUserAsync(int trainerId, int clientId, CancellationToken ct)
    {
        var userId = await db.Clients.Where(c => c.Id == clientId && c.TrainerId == trainerId)
            .Select(c => c.UserId).SingleOrDefaultAsync(ct);
        return userId is null ? null : await users.FindByIdAsync(userId.Value.ToString());
    }

    private void Audit(int userId, string action, int? clientId) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = userId, Action = action,
        EntityType = nameof(Client), EntityId = clientId?.ToString()
    });

    private static string[] Errors(IdentityResult result) => result.Errors.Select(e => e.Description).ToArray();
}

/// <summary>Genera contraseñas temporales aleatorias que cumplen la política (sin caracteres ambiguos).</summary>
public static class TemporaryPassword
{
    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lower = "abcdefghijkmnpqrstuvwxyz";
    private const string Digits = "23456789";

    public static string Generate(int length = 14)
    {
        var all = Upper + Lower + Digits;
        var chars = new char[length];
        chars[0] = Upper[RandomNumberGenerator.GetInt32(Upper.Length)];
        chars[1] = Lower[RandomNumberGenerator.GetInt32(Lower.Length)];
        chars[2] = Digits[RandomNumberGenerator.GetInt32(Digits.Length)];
        for (var i = 3; i < length; i++) chars[i] = all[RandomNumberGenerator.GetInt32(all.Length)];
        RandomNumberGenerator.Shuffle(chars.AsSpan());
        return new string(chars);
    }
}
