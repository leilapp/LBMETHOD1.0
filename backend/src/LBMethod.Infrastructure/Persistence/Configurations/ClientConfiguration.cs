using LBMethod.Domain.Clients;
using LBMethod.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LBMethod.Infrastructure.Persistence.Configurations;

public class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> b)
    {
        b.Property(c => c.FirstName).HasMaxLength(100).IsRequired();
        b.Property(c => c.LastName).HasMaxLength(100).IsRequired();
        b.Property(c => c.Email).HasMaxLength(256).IsRequired();
        b.Property(c => c.Phone).HasMaxLength(30);
        b.Property(c => c.Goal).HasMaxLength(500);
        b.Property(c => c.DeclaredLimitations).HasMaxLength(2000);
        b.Property(c => c.Height).HasPrecision(5, 2);
        b.Property(c => c.Weight).HasPrecision(6, 2);

        b.HasOne<AppUser>().WithMany().HasForeignKey(c => c.TrainerId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(c => c.UserId);

        // Correo único; una cuenta de usuario pertenece como máximo a un perfil de cliente.
        b.HasIndex(c => c.Email).IsUnique();
        b.HasIndex(c => c.UserId).IsUnique().HasFilter("[UserId] IS NOT NULL");
        b.HasIndex(c => new { c.TrainerId, c.Status });

        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Clients_Height", "[Height] IS NULL OR ([Height] > 0 AND [HeightUnit] IS NOT NULL)");
            t.HasCheckConstraint("CK_Clients_Weight", "[Weight] IS NULL OR ([Weight] > 0 AND [WeightUnit] IS NOT NULL)");
            t.HasCheckConstraint("CK_Clients_SessionDuration", "[SessionDurationMinutes] IS NULL OR [SessionDurationMinutes] > 0");
        });
    }
}

public class ClientNoteConfiguration : IEntityTypeConfiguration<ClientNote>
{
    public void Configure(EntityTypeBuilder<ClientNote> b)
    {
        b.Property(n => n.Content).HasMaxLength(4000).IsRequired();
        b.HasOne(n => n.Client).WithMany(c => c.PrivateNotes).HasForeignKey(n => n.ClientId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(n => n.AuthorUserId);
        b.HasIndex(n => new { n.ClientId, n.CreatedAt });
    }
}
