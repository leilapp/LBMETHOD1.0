using LBMethod.Domain.Exercises;
using LBMethod.Domain.Files;
using LBMethod.Infrastructure.Identity;
using LBMethod.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LBMethod.Infrastructure.Persistence.Configurations;

public class ExerciseConfiguration : IEntityTypeConfiguration<Exercise>
{
    public void Configure(EntityTypeBuilder<Exercise> b)
    {
        b.Property(e => e.NameEs).HasMaxLength(150).IsRequired().UseCollation(Collations.CatalogNames);
        b.Property(e => e.NameEn).HasMaxLength(150).UseCollation(Collations.CatalogNames);
        b.Property(e => e.Description).HasMaxLength(2000);
        b.Property(e => e.Instructions).HasMaxLength(4000);
        b.Property(e => e.CommonMistakes).HasMaxLength(2000);
        b.Property(e => e.TechnicalTips).HasMaxLength(2000);

        b.HasOne(e => e.MovementPattern).WithMany().HasForeignKey(e => e.MovementPatternId);

        // Evitar duplicados en el catálogo (la intercalación de SQL Server ignora mayúsculas).
        b.HasIndex(e => e.NameEs).IsUnique();
        b.HasIndex(e => e.NameEn).IsUnique().HasFilter("[NameEn] IS NOT NULL");
        b.HasIndex(e => e.IsActive);
    }
}

public class MuscleGroupConfiguration : IEntityTypeConfiguration<MuscleGroup>
{
    public void Configure(EntityTypeBuilder<MuscleGroup> b)
    {
        b.Property(m => m.NameEs).HasMaxLength(100).IsRequired().UseCollation(Collations.CatalogNames);
        b.Property(m => m.NameEn).HasMaxLength(100).IsRequired().UseCollation(Collations.CatalogNames);
        b.HasIndex(m => m.NameEs).IsUnique();
        b.HasIndex(m => m.NameEn).IsUnique();
        b.HasData(ReferenceData.MuscleGroups);
    }
}

public class EquipmentConfiguration : IEntityTypeConfiguration<Equipment>
{
    public void Configure(EntityTypeBuilder<Equipment> b)
    {
        b.ToTable("Equipment");
        b.Property(e => e.NameEs).HasMaxLength(100).IsRequired().UseCollation(Collations.CatalogNames);
        b.Property(e => e.NameEn).HasMaxLength(100).IsRequired().UseCollation(Collations.CatalogNames);
        b.HasIndex(e => e.NameEs).IsUnique();
        b.HasIndex(e => e.NameEn).IsUnique();
    }
}

public class MovementPatternConfiguration : IEntityTypeConfiguration<MovementPattern>
{
    public void Configure(EntityTypeBuilder<MovementPattern> b)
    {
        b.Property(m => m.NameEs).HasMaxLength(100).IsRequired().UseCollation(Collations.CatalogNames);
        b.Property(m => m.NameEn).HasMaxLength(100).IsRequired().UseCollation(Collations.CatalogNames);
        b.HasIndex(m => m.NameEs).IsUnique();
        b.HasIndex(m => m.NameEn).IsUnique();
    }
}

public class ExerciseMuscleConfiguration : IEntityTypeConfiguration<ExerciseMuscle>
{
    public void Configure(EntityTypeBuilder<ExerciseMuscle> b)
    {
        b.HasKey(x => new { x.ExerciseId, x.MuscleGroupId });
        b.HasOne(x => x.Exercise).WithMany(e => e.Muscles).HasForeignKey(x => x.ExerciseId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.MuscleGroup).WithMany().HasForeignKey(x => x.MuscleGroupId);
        b.HasIndex(x => x.MuscleGroupId);
        // Un solo músculo principal por ejercicio.
        b.HasIndex(x => x.ExerciseId).IsUnique().HasFilter("[Role] = 1").HasDatabaseName("UX_ExerciseMuscles_OnePrimary");
    }
}

public class ExerciseEquipmentConfiguration : IEntityTypeConfiguration<ExerciseEquipment>
{
    public void Configure(EntityTypeBuilder<ExerciseEquipment> b)
    {
        b.HasKey(x => new { x.ExerciseId, x.EquipmentId });
        b.HasOne(x => x.Exercise).WithMany(e => e.Equipment).HasForeignKey(x => x.ExerciseId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Equipment).WithMany().HasForeignKey(x => x.EquipmentId);
        b.HasIndex(x => x.EquipmentId);
    }
}

public class ExerciseVariantConfiguration : IEntityTypeConfiguration<ExerciseVariant>
{
    public void Configure(EntityTypeBuilder<ExerciseVariant> b)
    {
        b.HasKey(x => new { x.ExerciseId, x.VariantExerciseId });
        b.Property(x => x.Note).HasMaxLength(500);
        b.HasOne(x => x.Exercise).WithMany(e => e.Variants).HasForeignKey(x => x.ExerciseId);
        b.HasOne(x => x.VariantExercise).WithMany().HasForeignKey(x => x.VariantExerciseId);
        b.HasIndex(x => x.VariantExerciseId);
        b.ToTable(t => t.HasCheckConstraint("CK_ExerciseVariants_NotSelf", "[ExerciseId] <> [VariantExerciseId]"));
    }
}

public class ExerciseMediaConfiguration : IEntityTypeConfiguration<ExerciseMedia>
{
    public void Configure(EntityTypeBuilder<ExerciseMedia> b)
    {
        b.Property(m => m.ExternalUrl).HasMaxLength(1000);
        b.Property(m => m.Title).HasMaxLength(150);
        b.HasOne(m => m.Exercise).WithMany(e => e.Media).HasForeignKey(m => m.ExerciseId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(m => m.StoredFile).WithMany().HasForeignKey(m => m.StoredFileId);
        b.HasIndex(m => new { m.ExerciseId, m.SortOrder });
        // Exactamente un origen: archivo privado o enlace externo.
        b.ToTable(t => t.HasCheckConstraint("CK_ExerciseMedia_OneSource",
            "([StoredFileId] IS NOT NULL AND [ExternalUrl] IS NULL) OR ([StoredFileId] IS NULL AND [ExternalUrl] IS NOT NULL)"));
    }
}

public class ExerciseFavoriteConfiguration : IEntityTypeConfiguration<ExerciseFavorite>
{
    public void Configure(EntityTypeBuilder<ExerciseFavorite> b)
    {
        b.HasKey(x => new { x.UserId, x.ExerciseId });
        b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId);
        b.HasOne(x => x.Exercise).WithMany().HasForeignKey(x => x.ExerciseId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.ExerciseId);
    }
}

public class StoredFileConfiguration : IEntityTypeConfiguration<StoredFile>
{
    public void Configure(EntityTypeBuilder<StoredFile> b)
    {
        b.Property(f => f.Id).ValueGeneratedNever();
        b.Property(f => f.OriginalFileName).HasMaxLength(255).IsRequired();
        b.Property(f => f.ContentType).HasMaxLength(100).IsRequired();
        b.Property(f => f.Sha256).HasMaxLength(64).IsFixedLength();
        b.Property(f => f.StorageProvider).HasMaxLength(30).IsRequired();
        b.Property(f => f.StorageKey).HasMaxLength(500).IsRequired();

        b.HasOne<Domain.Clients.Client>().WithMany().HasForeignKey(f => f.OwnerClientId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(f => f.UploadedByUserId);

        b.HasIndex(f => new { f.StorageProvider, f.StorageKey }).IsUnique();
        b.HasIndex(f => f.OwnerClientId);
        b.ToTable(t => t.HasCheckConstraint("CK_StoredFiles_Size", "[SizeBytes] > 0"));
    }
}
