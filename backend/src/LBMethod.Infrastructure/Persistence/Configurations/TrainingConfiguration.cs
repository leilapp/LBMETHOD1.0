using LBMethod.Domain.Training;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LBMethod.Infrastructure.Persistence.Configurations;

public class TrainingLogConfiguration : IEntityTypeConfiguration<TrainingLog>
{
    public void Configure(EntityTypeBuilder<TrainingLog> b)
    {
        b.Property(l => l.RoutineTitle).HasMaxLength(150);
        b.Property(l => l.DayName).HasMaxLength(100);
        b.Property(l => l.Comment).HasMaxLength(2000);

        b.HasOne(l => l.Client).WithMany().HasForeignKey(l => l.ClientId);
        b.HasOne(l => l.RoutineAssignment).WithMany().HasForeignKey(l => l.RoutineAssignmentId);
        b.HasOne(l => l.RoutineDay).WithMany().HasForeignKey(l => l.RoutineDayId);

        b.HasIndex(l => new { l.ClientId, l.StartedAt });
        b.HasIndex(l => l.RoutineAssignmentId);
        // Una sola sesión en curso por cliente: al retomar se continúa la misma, sin duplicados.
        b.HasIndex(l => l.ClientId).IsUnique().HasFilter("[Status] = 1").HasDatabaseName("UX_TrainingLogs_OneInProgress");

        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_TrainingLogs_Completed", "[Status] <> 2 OR [CompletedAt] IS NOT NULL");
            t.HasCheckConstraint("CK_TrainingLogs_Dates", "[CompletedAt] IS NULL OR [CompletedAt] >= [StartedAt]");
        });
    }
}

public class TrainingLogExerciseConfiguration : IEntityTypeConfiguration<TrainingLogExercise>
{
    public void Configure(EntityTypeBuilder<TrainingLogExercise> b)
    {
        b.Property(x => x.ExerciseNameEs).HasMaxLength(150).IsRequired();
        b.Property(x => x.ExerciseNameEn).HasMaxLength(150);
        b.Property(x => x.SupersetGroup).HasMaxLength(10);
        b.Property(x => x.PrescribedTempo).HasMaxLength(20);
        b.Property(x => x.PrescribedNotes).HasMaxLength(1000);
        b.Property(x => x.Comment).HasMaxLength(1000);
        b.Property(x => x.PrescribedWeight).HasPrecision(7, 2);
        b.Property(x => x.PrescribedRir).HasPrecision(3, 1);
        b.Property(x => x.PrescribedRpe).HasPrecision(3, 1);

        b.HasOne(x => x.TrainingLog).WithMany(l => l.Exercises).HasForeignKey(x => x.TrainingLogId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Exercise).WithMany().HasForeignKey(x => x.ExerciseId);
        b.HasOne(x => x.RoutineExercise).WithMany().HasForeignKey(x => x.RoutineExerciseId);

        b.HasIndex(x => new { x.TrainingLogId, x.Position }).IsUnique();
        b.HasIndex(x => x.ExerciseId);
        b.HasIndex(x => x.RoutineExerciseId);
    }
}

public class TrainingLogSetConfiguration : IEntityTypeConfiguration<TrainingLogSet>
{
    public void Configure(EntityTypeBuilder<TrainingLogSet> b)
    {
        b.Property(x => x.Notes).HasMaxLength(500);
        b.Property(x => x.Weight).HasPrecision(7, 2);
        b.Property(x => x.Rir).HasPrecision(3, 1);
        b.Property(x => x.Rpe).HasPrecision(3, 1);
        b.HasOne(x => x.TrainingLogExercise).WithMany(e => e.Sets).HasForeignKey(x => x.TrainingLogExerciseId).OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.TrainingLogExerciseId, x.SetNumber }).IsUnique();
        b.ToTable(t =>
        {
            t.HasCheckConstraint("CK_TrainingLogSets_SetNumber", "[SetNumber] >= 1");
            t.HasCheckConstraint("CK_TrainingLogSets_Reps", "[Reps] IS NULL OR [Reps] >= 0");
            t.HasCheckConstraint("CK_TrainingLogSets_Weight", "[Weight] IS NULL OR ([Weight] >= 0 AND [WeightUnit] IS NOT NULL)");
            t.HasCheckConstraint("CK_TrainingLogSets_Rir", "[Rir] IS NULL OR ([Rir] >= 0 AND [Rir] <= 10)");
            t.HasCheckConstraint("CK_TrainingLogSets_Rpe", "[Rpe] IS NULL OR ([Rpe] >= 1 AND [Rpe] <= 10)");
        });
    }
}
