using LBMethod.Domain.Routines;
using LBMethod.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LBMethod.Infrastructure.Persistence.Configurations;

public class RoutineConfiguration : IEntityTypeConfiguration<Routine>
{
    public void Configure(EntityTypeBuilder<Routine> b)
    {
        b.Property(r => r.Name).HasMaxLength(150).IsRequired();
        b.HasOne<AppUser>().WithMany().HasForeignKey(r => r.TrainerId);
        b.HasIndex(r => new { r.TrainerId, r.Kind, r.Status });
    }
}

public class RoutineVersionConfiguration : IEntityTypeConfiguration<RoutineVersion>
{
    public void Configure(EntityTypeBuilder<RoutineVersion> b)
    {
        b.Property(v => v.Title).HasMaxLength(150).IsRequired();
        b.Property(v => v.Description).HasMaxLength(2000);
        b.Property(v => v.Goal).HasMaxLength(500);
        b.Property(v => v.ChangeNotes).HasMaxLength(1000);

        // Las versiones nunca se borran en cascada desde la rutina (historial).
        b.HasOne(v => v.Routine).WithMany(r => r.Versions).HasForeignKey(v => v.RoutineId);
        b.HasOne(v => v.SourceVersion).WithMany().HasForeignKey(v => v.SourceVersionId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(v => v.PublishedByUserId);

        b.HasIndex(v => new { v.RoutineId, v.VersionNumber }).IsUnique();
        // Solo un borrador por rutina.
        b.HasIndex(v => v.RoutineId).IsUnique().HasFilter("[Status] = 1").HasDatabaseName("UX_RoutineVersions_OneDraft");

        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_RoutineVersions_VersionNumber", "[VersionNumber] >= 1");
            t.HasCheckConstraint("CK_RoutineVersions_Duration", "[DurationWeeks] IS NULL OR [DurationWeeks] > 0");
            t.HasCheckConstraint("CK_RoutineVersions_Published", "[Status] <> 2 OR [PublishedAt] IS NOT NULL");
        });
    }
}

public class RoutineDayConfiguration : IEntityTypeConfiguration<RoutineDay>
{
    public void Configure(EntityTypeBuilder<RoutineDay> b)
    {
        b.Property(d => d.Name).HasMaxLength(100).IsRequired();
        b.Property(d => d.Notes).HasMaxLength(1000);
        b.HasOne(d => d.RoutineVersion).WithMany(v => v.Days).HasForeignKey(d => d.RoutineVersionId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(d => new { d.RoutineVersionId, d.Position }).IsUnique();
    }
}

public class RoutineExerciseConfiguration : IEntityTypeConfiguration<RoutineExercise>
{
    public void Configure(EntityTypeBuilder<RoutineExercise> b)
    {
        b.Property(x => x.SupersetGroup).HasMaxLength(10);
        b.Property(x => x.Tempo).HasMaxLength(20);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.SuggestedWeight).HasPrecision(7, 2);
        b.Property(x => x.Rir).HasPrecision(3, 1);
        b.Property(x => x.Rpe).HasPrecision(3, 1);

        b.HasOne(x => x.RoutineDay).WithMany(d => d.Exercises).HasForeignKey(x => x.RoutineDayId).OnDelete(DeleteBehavior.Cascade);
        // El ejercicio del catálogo no se puede borrar mientras alguna rutina lo use.
        b.HasOne(x => x.Exercise).WithMany().HasForeignKey(x => x.ExerciseId);

        b.HasIndex(x => new { x.RoutineDayId, x.Position }).IsUnique();
        b.HasIndex(x => x.ExerciseId);

        b.ToTable(t => PrescriptionChecks.Add(t, "RoutineExercises", hasSets: true));
    }
}

public class RoutineExerciseSetConfiguration : IEntityTypeConfiguration<RoutineExerciseSet>
{
    public void Configure(EntityTypeBuilder<RoutineExerciseSet> b)
    {
        b.Property(x => x.Notes).HasMaxLength(500);
        b.Property(x => x.SuggestedWeight).HasPrecision(7, 2);
        b.Property(x => x.Rir).HasPrecision(3, 1);
        b.Property(x => x.Rpe).HasPrecision(3, 1);
        b.HasOne(x => x.RoutineExercise).WithMany(e => e.SetDetails).HasForeignKey(x => x.RoutineExerciseId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.RoutineExerciseId, x.SetNumber }).IsUnique();
        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_RoutineExerciseSets_SetNumber", "[SetNumber] >= 1");
            PrescriptionChecks.Add(t, "RoutineExerciseSets", hasSets: false);
        });
    }
}

public class RoutineAssignmentConfiguration : IEntityTypeConfiguration<RoutineAssignment>
{
    public void Configure(EntityTypeBuilder<RoutineAssignment> b)
    {
        b.Property(a => a.Notes).HasMaxLength(1000);
        b.HasOne(a => a.Client).WithMany().HasForeignKey(a => a.ClientId);
        b.HasOne(a => a.RoutineVersion).WithMany().HasForeignKey(a => a.RoutineVersionId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(a => a.AssignedByUserId);

        b.HasIndex(a => new { a.ClientId, a.Status, a.StartDate });
        b.HasIndex(a => a.RoutineVersionId);
        b.ToTable(t => t.HasCheckConstraint("CK_RoutineAssignments_Dates", "[EndDate] IS NULL OR [EndDate] >= [StartDate]"));
    }
}

/// <summary>Restricciones comunes de los parámetros prescritos.</summary>
internal static class PrescriptionChecks
{
    public static void Add(Microsoft.EntityFrameworkCore.Metadata.Builders.TableBuilder t, string table, bool hasSets)
    {
        if (hasSets)
            t.HasCheckConstraint($"CK_{table}_Sets", "[Sets] >= 1");
        t.HasCheckConstraint($"CK_{table}_Reps", "([RepsMin] IS NULL OR [RepsMin] >= 0) AND ([RepsMax] IS NULL OR [RepsMax] >= 0) AND ([RepsMin] IS NULL OR [RepsMax] IS NULL OR [RepsMin] <= [RepsMax])");
        t.HasCheckConstraint($"CK_{table}_Weight", "[SuggestedWeight] IS NULL OR ([SuggestedWeight] >= 0 AND [SuggestedWeightUnit] IS NOT NULL)");
        t.HasCheckConstraint($"CK_{table}_Rest", "[RestSeconds] IS NULL OR [RestSeconds] >= 0");
        t.HasCheckConstraint($"CK_{table}_Rir", "[Rir] IS NULL OR ([Rir] >= 0 AND [Rir] <= 10)");
        t.HasCheckConstraint($"CK_{table}_Rpe", "[Rpe] IS NULL OR ([Rpe] >= 1 AND [Rpe] <= 10)");
    }
}
