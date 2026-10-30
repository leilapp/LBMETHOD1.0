using LBMethod.Application.Abstractions;
using LBMethod.Domain.Clients;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Security;

/// <summary>
/// Punto único de aislamiento de datos por propiedad. Toda consulta de datos de clientes debe partir de aquí:
/// la entrenadora solo ve sus propios clientes y un cliente solo se ve a sí mismo.
/// Un recurso ajeno se trata como inexistente (404), para no revelar que existe.
/// </summary>
public class ClientAccess(IAppDbContext db, ICurrentUser user)
{
    /// <summary>Clientes que el usuario actual puede ver.</summary>
    public IQueryable<Client> VisibleClients()
    {
        if (!user.IsAuthenticated) return db.Clients.Where(_ => false);
        var userId = user.UserId;
        if (user.IsTrainer) return db.Clients.Where(c => c.TrainerId == userId);
        if (user.IsClient) return db.Clients.Where(c => c.UserId == userId);
        return db.Clients.Where(_ => false);
    }

    /// <summary>Id del perfil de cliente asociado a la cuenta actual, o null si no es un cliente.</summary>
    public async Task<int?> CurrentClientIdAsync(CancellationToken ct = default)
    {
        if (!user.IsAuthenticated || !user.IsClient) return null;
        var userId = user.UserId;
        return await db.Clients.Where(c => c.UserId == userId).Select(c => (int?)c.Id).SingleOrDefaultAsync(ct);
    }

    /// <summary>Verdadero si la entrenadora actual es dueña del cliente indicado.</summary>
    public Task<bool> TrainerOwnsClientAsync(int clientId, CancellationToken ct = default)
    {
        if (!user.IsAuthenticated || !user.IsTrainer) return Task.FromResult(false);
        var userId = user.UserId;
        return db.Clients.AnyAsync(c => c.Id == clientId && c.TrainerId == userId, ct);
    }
}
