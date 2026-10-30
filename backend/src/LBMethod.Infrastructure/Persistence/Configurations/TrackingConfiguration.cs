using LBMethod.Domain.Audit;
using LBMethod.Domain.Calendar;
using LBMethod.Domain.Routines;
using LBMethod.Domain.Tracking;
using LBMethod.Domain.Training;
using LBMethod.Infrastructure.Identity;
using LBMethod.Infrastructure.Persistence.Seed;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LBMethod.Infrastructure.Persistence.Configurations;

public class MeasurementTypeConfiguration : IEntityTypeConfiguration<MeasurementType>
{
    public void Configure(EntityTypeBuilder<MeasurementType> b)
    {
        b.Property(m => m.NameEs).HasMaxLength(100).IsRequired();
        b.Property(m => m.NameEn).HasMaxLength(100).IsRequired();
        b.Property(m => m.Unit).HasMaxLength(10).IsRequired();
        b.HasIndex(m => m.NameEs).IsUnique();
        b.HasIndex(m => m.NameEn).IsUnique();
        b.HasData(ReferenceData.MeasurementTypes);
    }
}

public class EvaluationConfiguration : IEntityTypeConfiguration<Evaluation>
{
    public void Configure(EntityTypeBuilder<Evaluation> b)
    {
        b.Property(e => e.Notes).HasMaxLength(2000);
        b.HasOne(e => e.Client).WithMany().HasForeignKey(e => e.ClientId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(e => e.PerformedByUserId);
        b.HasIndex(e => new { e.ClientId, e.EvaluatedOn });
    }
}

public class MeasurementConfiguration : IEntityTypeConfiguration<Measurement>
{
    public void Configure(EntityTypeBuilder<Measurement> b)
    {
        b.Property(m => m.Value).HasPrecision(8, 2);
        b.Property(m => m.Unit).HasMaxLength(10).IsRequired();
        b.Property(m => m.Notes).HasMaxLength(1000);
        b.HasOne(m => m.Client).WithMany().HasForeignKey(m => m.ClientId);
        b.HasOne(m => m.MeasurementType).WithMany().HasForeignKey(m => m.MeasurementTypeId);
        b.HasOne(m => m.Evaluation).WithMany(e => e.Measurements).HasForeignKey(m => m.EvaluationId);
        b.HasOne<AppUser>().WithMany().HasForeignKey(m => m.RecordedByUserId);
        b.HasIndex(m => new { m.ClientId, m.MeasurementTypeId, m.MeasuredOn });
        b.HasIndex(m => m.EvaluationId);
        b.ToTable(t => t.HasCheckConstraint("CK_Measurements_Value", "[Value] > 0"));
    }
}

public class ProgressPhotoConfiguration : IEntityTypeConfiguration<ProgressPhoto>
{
    public void Configure(EntityTypeBuilder<ProgressPhoto> b)
    {
        b.Property(p => p.Notes).HasMaxLength(1000);
        b.HasOne(p => p.Client).WithMany().HasForeignKey(p => p.ClientId);
        b.HasOne(p => p.StoredFile).WithMany().HasForeignKey(p => p.StoredFileId);
        b.HasOne(p => p.Evaluation).WithMany().HasForeignKey(p => p.EvaluationId);
        b.HasIndex(p => p.StoredFileId).IsUnique();
        b.HasIndex(p => new { p.ClientId, p.TakenOn });
        b.HasIndex(p => p.EvaluationId);
    }
}

public class CalendarEventConfiguration : IEntityTypeConfiguration<CalendarEvent>
{
    public void Configure(EntityTypeBuilder<CalendarEvent> b)
    {
        b.Property(e => e.Title).HasMaxLength(150).IsRequired();
        b.Property(e => e.Notes).HasMaxLength(1000);
        b.HasOne<AppUser>().WithMany().HasForeignKey(e => e.TrainerId);
        b.HasOne(e => e.Client).WithMany().HasForeignKey(e => e.ClientId);
        b.HasOne<RoutineAssignment>().WithMany().HasForeignKey(e => e.RoutineAssignmentId);
        b.HasOne<RoutineDay>().WithMany().HasForeignKey(e => e.RoutineDayId);
        b.HasOne<TrainingLog>().WithMany().HasForeignKey(e => e.TrainingLogId);
        b.HasOne<Evaluation>().WithMany().HasForeignKey(e => e.EvaluationId);

        b.HasIndex(e => new { e.ClientId, e.Date });
        b.HasIndex(e => new { e.TrainerId, e.Date });
        b.HasIndex(e => e.RoutineAssignmentId);
        b.HasIndex(e => e.RoutineDayId);
        b.HasIndex(e => e.TrainingLogId);
        b.HasIndex(e => e.EvaluationId);
        b.ToTable(t => t.HasCheckConstraint("CK_CalendarEvents_Times",
            "[EndTime] IS NULL OR ([StartTime] IS NOT NULL AND [EndTime] >= [StartTime])"));
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> b)
    {
        b.Property(a => a.Action).HasMaxLength(100).IsRequired();
        b.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
        b.Property(a => a.EntityId).HasMaxLength(64);
        b.Property(a => a.Details).HasMaxLength(4000);
        b.Property(a => a.IpAddress).HasMaxLength(45);
        b.Property(a => a.OccurredAt).HasDefaultValueSql("SYSUTCDATETIME()");
        b.HasIndex(a => a.OccurredAt);
        b.HasIndex(a => new { a.EntityType, a.EntityId });
        b.HasIndex(a => a.UserId);
    }
}
