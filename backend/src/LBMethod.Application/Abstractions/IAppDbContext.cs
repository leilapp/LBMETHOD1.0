using LBMethod.Domain.Clients;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Abstractions;

/// <summary>Acceso a datos que necesitan los casos de uso. Lo implementa la infraestructura (SQL Server).</summary>
public interface IAppDbContext
{
    DbSet<Client> Clients { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
