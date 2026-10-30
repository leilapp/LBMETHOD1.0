using LBMethod.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LBMethod.Infrastructure.Persistence.Configurations;

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> b)
    {
        b.Property(u => u.DisplayName).HasMaxLength(150);
        b.Property(u => u.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
        b.Property(u => u.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
    }
}

public class AppRoleConfiguration : IEntityTypeConfiguration<AppRole>
{
    public void Configure(EntityTypeBuilder<AppRole> b)
    {
        // Roles fijos del sistema; los Id y sellos son constantes para que la migración sea reproducible.
        b.HasData(
            new AppRole(Roles.Trainer) { Id = 1, NormalizedName = Roles.Trainer, ConcurrencyStamp = "b6d1f0c2-5a2e-4f7e-9d3a-000000000001" },
            new AppRole(Roles.Client) { Id = 2, NormalizedName = Roles.Client, ConcurrencyStamp = "b6d1f0c2-5a2e-4f7e-9d3a-000000000002" });
    }
}
