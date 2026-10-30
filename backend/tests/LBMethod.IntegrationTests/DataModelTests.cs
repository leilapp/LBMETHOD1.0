using LBMethod.Domain.Clients;
using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Routines;
using LBMethod.Domain.Tracking;
using LBMethod.Domain.Training;
using LBMethod.Infrastructure.Persistence.Interceptors;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.IntegrationTests;

[Collection(SqlServerCollection.Name)]
public class DataModelTests(SqlServerFixture fx)
{
    [Fact]
    public async Task Migrations_are_applied_and_model_matches_last_migration()
    {
        await using var db = fx.CreateContext();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.False(db.Database.HasPendingModelChanges());
    }

    [Fact]
    public async Task Reference_data_from_the_guide_is_seeded()
    {
        await using var db = fx.CreateContext();
        Assert.Equal(12, await db.MuscleGroups.CountAsync());
        Assert.Contains(await db.MuscleGroups.Select(m => m.NameEs).ToListAsync(), n => n == "Glúteos");
        Assert.Equal(7, await db.MeasurementTypes.CountAsync());
        Assert.Equal(["CLIENT", "TRAINER"], await db.Roles.Select(r => r.Name!).OrderBy(n => n).ToListAsync());
    }

    [Fact]
    public async Task Exercise_is_reused_by_id_in_many_routines_and_cannot_be_deleted_while_in_use()
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var exercise = await TestData.ExerciseAsync(db);
        await TestData.RoutineAsync(db, trainer.Id, exercise.Id, publish: true);
        await TestData.RoutineAsync(db, trainer.Id, exercise.Id, publish: false);

        Assert.Equal(2, await db.RoutineExercises.CountAsync(x => x.ExerciseId == exercise.Id));
        Assert.Equal(1, await db.Exercises.CountAsync(e => e.NameEs == exercise.NameEs));

        // Bloqueado tanto por EF como directamente por la llave foránea en SQL Server.
        db.ChangeTracker.Clear();
        var sql = await Assert.ThrowsAsync<SqlException>(() => db.Exercises.Where(e => e.Id == exercise.Id).ExecuteDeleteAsync());
        Assert.Equal(547, sql.Number);
    }

    [Fact]
    public async Task Routine_parameters_do_not_modify_the_master_exercise()
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var exercise = await TestData.ExerciseAsync(db);
        var draft = await TestData.RoutineAsync(db, trainer.Id, exercise.Id, publish: false);
        var before = await db.Exercises.AsNoTracking().SingleAsync(e => e.Id == exercise.Id);

        var item = await db.RoutineExercises.SingleAsync(x => x.RoutineDay.RoutineVersionId == draft.Id);
        item.Sets = 5;
        item.RepsMin = 6;
        await db.SaveChangesAsync();

        var after = await db.Exercises.AsNoTracking().SingleAsync(e => e.Id == exercise.Id);
        Assert.Equal(before.UpdatedAt, after.UpdatedAt);
        Assert.Equal(before.NameEs, after.NameEs);
    }

    [Fact]
    public async Task Published_version_and_its_content_cannot_be_modified()
    {
        await using (var setup = fx.CreateContext())
        {
            var trainer = await TestData.UserAsync(setup);
            var exercise = await TestData.ExerciseAsync(setup);
            var published = await TestData.RoutineAsync(setup, trainer.Id, exercise.Id, publish: true);

            // Cambiar el título de la versión publicada
            await using (var db = fx.CreateContext())
            {
                var v = await db.RoutineVersions.SingleAsync(x => x.Id == published.Id);
                v.Title = "Cambio";
                await Assert.ThrowsAsync<PublishedVersionModificationException>(() => db.SaveChangesAsync());
            }

            // Cambiar parámetros de un ejercicio
            await using (var db = fx.CreateContext())
            {
                var item = await db.RoutineExercises.SingleAsync(x => x.RoutineDay.RoutineVersionId == published.Id);
                item.Sets = 10;
                await Assert.ThrowsAsync<PublishedVersionModificationException>(() => db.SaveChangesAsync());
            }

            // Agregar un día nuevo
            await using (var db = fx.CreateContext())
            {
                db.RoutineDays.Add(new RoutineDay { RoutineVersionId = published.Id, Position = 2, Name = "Día 2" });
                await Assert.ThrowsAsync<PublishedVersionModificationException>(() => db.SaveChangesAsync());
            }

            // Agregar detalle de serie a un ejercicio publicado
            await using (var db = fx.CreateContext())
            {
                var itemId = await db.RoutineExercises.Where(x => x.RoutineDay.RoutineVersionId == published.Id).Select(x => x.Id).SingleAsync();
                db.RoutineExerciseSets.Add(new RoutineExerciseSet { RoutineExerciseId = itemId, SetNumber = 1 });
                await Assert.ThrowsAsync<PublishedVersionModificationException>(() => db.SaveChangesAsync());
            }

            // Borrar la versión
            await using (var db = fx.CreateContext())
            {
                db.RoutineVersions.Remove(await db.RoutineVersions.SingleAsync(x => x.Id == published.Id));
                await Assert.ThrowsAsync<PublishedVersionModificationException>(() => db.SaveChangesAsync());
            }

            await using (var db = fx.CreateContext())
            {
                var reloaded = await db.RoutineVersions.Include(v => v.Days).ThenInclude(d => d.Exercises)
                    .SingleAsync(x => x.Id == published.Id);
                Assert.Equal("Fuerza glúteo", reloaded.Title);
                Assert.Single(reloaded.Days);
                Assert.Equal(4, reloaded.Days.Single().Exercises.Single().Sets);
            }
        }
    }

    [Fact]
    public async Task Draft_can_be_edited_and_then_published()
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var exercise = await TestData.ExerciseAsync(db);
        var draft = await TestData.RoutineAsync(db, trainer.Id, exercise.Id, publish: false);

        db.RoutineDays.Add(new RoutineDay { RoutineVersionId = draft.Id, Position = 2, Name = "Día 2" });
        draft.Title = "Editado";
        await db.SaveChangesAsync();

        draft.Status = RoutineVersionStatus.Published;
        draft.PublishedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        Assert.Equal(2, await db.RoutineDays.CountAsync(d => d.RoutineVersionId == draft.Id));
    }

    [Fact]
    public async Task Only_one_draft_per_routine_and_version_numbers_are_unique()
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var exercise = await TestData.ExerciseAsync(db);
        var draft = await TestData.RoutineAsync(db, trainer.Id, exercise.Id, publish: false);

        db.RoutineVersions.Add(new RoutineVersion { RoutineId = draft.RoutineId, VersionNumber = 2, Title = "Otro borrador" });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        db.ChangeTracker.Clear();

        db.RoutineVersions.Add(new RoutineVersion
        {
            RoutineId = draft.RoutineId, VersionNumber = 1, Title = "Número repetido",
            Status = RoutineVersionStatus.Published, PublishedAt = DateTime.UtcNow
        });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Assignment_points_to_a_specific_version_shared_by_many_clients()
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var exercise = await TestData.ExerciseAsync(db);
        var v1 = await TestData.RoutineAsync(db, trainer.Id, exercise.Id, publish: true);
        var clientA = await TestData.ClientAsync(db, trainer.Id);
        var clientB = await TestData.ClientAsync(db, trainer.Id);

        foreach (var c in new[] { clientA, clientB })
            db.RoutineAssignments.Add(new RoutineAssignment
            {
                ClientId = c.Id, RoutineVersionId = v1.Id, AssignedByUserId = trainer.Id,
                StartDate = new DateOnly(2026, 11, 2), EndDate = new DateOnly(2026, 12, 14), Status = AssignmentStatus.Active
            });
        await db.SaveChangesAsync();

        // Publicar una versión 2 no cambia las asignaciones a la versión 1 ni duplica los ejercicios.
        db.RoutineVersions.Add(new RoutineVersion
        {
            RoutineId = v1.RoutineId, VersionNumber = 2, Title = "v2", SourceVersionId = v1.Id,
            Status = RoutineVersionStatus.Published, PublishedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var assigned = await db.RoutineAssignments.Where(a => a.RoutineVersion.RoutineId == v1.RoutineId)
            .Select(a => a.RoutineVersionId).ToListAsync();
        Assert.Equal([v1.Id, v1.Id], assigned);
        Assert.Equal(1, await db.RoutineExercises.CountAsync(x => x.RoutineDay.RoutineVersion.RoutineId == v1.RoutineId));
    }

    [Fact]
    public async Task Training_log_keeps_its_snapshot_when_the_routine_and_exercise_change()
    {
        int logId;
        RoutineVersion v1;
        await using (var db = fx.CreateContext())
        {
            var trainer = await TestData.UserAsync(db);
            var exercise = await TestData.ExerciseAsync(db);
            v1 = await TestData.RoutineAsync(db, trainer.Id, exercise.Id, publish: true);
            var client = await TestData.ClientAsync(db, trainer.Id);
            var assignment = new RoutineAssignment
            {
                ClientId = client.Id, RoutineVersionId = v1.Id, AssignedByUserId = trainer.Id,
                StartDate = new DateOnly(2026, 11, 2), Status = AssignmentStatus.Active
            };
            db.RoutineAssignments.Add(assignment);
            await db.SaveChangesAsync();

            var day = await db.RoutineDays.Include(d => d.Exercises).ThenInclude(x => x.Exercise)
                .SingleAsync(d => d.RoutineVersionId == v1.Id);
            var rx = day.Exercises.Single();
            var log = new TrainingLog
            {
                ClientId = client.Id, RoutineAssignmentId = assignment.Id, RoutineDayId = day.Id,
                RoutineTitle = v1.Title, RoutineVersionNumber = v1.VersionNumber, DayName = day.Name,
                StartedAt = DateTime.UtcNow, Status = TrainingLogStatus.Completed, CompletedAt = DateTime.UtcNow.AddMinutes(50)
            };
            var lx = new TrainingLogExercise
            {
                ExerciseId = rx.ExerciseId, RoutineExerciseId = rx.Id, Position = 1,
                ExerciseNameEs = rx.Exercise.NameEs, ExerciseNameEn = rx.Exercise.NameEn,
                PrescribedSets = rx.Sets, PrescribedRepsMin = rx.RepsMin, PrescribedRepsMax = rx.RepsMax,
                PrescribedWeight = rx.SuggestedWeight, PrescribedWeightUnit = rx.SuggestedWeightUnit,
                PrescribedRestSeconds = rx.RestSeconds, PrescribedTempo = rx.Tempo, PrescribedRir = rx.Rir,
                IsCompleted = true
            };
            lx.Sets.Add(new TrainingLogSet { SetNumber = 1, Reps = 10, Weight = 62.5m, WeightUnit = WeightUnit.Kg, IsCompleted = true });
            lx.Sets.Add(new TrainingLogSet { SetNumber = 2, Reps = 9, Weight = 62.5m, WeightUnit = WeightUnit.Kg, IsCompleted = true });
            log.Exercises.Add(lx);
            db.TrainingLogs.Add(log);
            await db.SaveChangesAsync();
            logId = log.Id;
        }

        // La entrenadora crea la versión 2 con otros parámetros, renombra y desactiva el ejercicio.
        await using (var db = fx.CreateContext())
        {
            var source = await db.RoutineDays.Include(d => d.Exercises).SingleAsync(d => d.RoutineVersionId == v1.Id);
            var v2 = new RoutineVersion { RoutineId = v1.RoutineId, VersionNumber = 2, Title = "Fuerza glúteo v2", SourceVersionId = v1.Id };
            var day2 = new RoutineDay { Position = 1, Name = "Día A" };
            day2.Exercises.Add(new RoutineExercise { ExerciseId = source.Exercises.Single().ExerciseId, Position = 1, Sets = 3, RepsMin = 15, RepsMax = 20 });
            v2.Days.Add(day2);
            db.RoutineVersions.Add(v2);

            var exercise = await db.Exercises.SingleAsync(e => e.Id == source.Exercises.Single().ExerciseId);
            exercise.NameEs = TestData.Unique("Nombre nuevo");
            exercise.IsActive = false;
            exercise.DeactivatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        await using (var db = fx.CreateContext())
        {
            var log = await db.TrainingLogs.Include(l => l.Exercises).ThenInclude(x => x.Sets).SingleAsync(l => l.Id == logId);
            var lx = log.Exercises.Single();
            Assert.Equal("Fuerza glúteo", log.RoutineTitle);
            Assert.Equal(1, log.RoutineVersionNumber);
            Assert.Equal("Día 1 - Pierna", log.DayName);
            Assert.StartsWith("Hip thrust", lx.ExerciseNameEs);
            Assert.Equal(4, lx.PrescribedSets);
            Assert.Equal(8, lx.PrescribedRepsMin);
            Assert.Equal(60m, lx.PrescribedWeight);
            Assert.Equal([62.5m, 62.5m], lx.Sets.OrderBy(s => s.SetNumber).Select(s => s.Weight!.Value));
            Assert.Equal([10, 9], lx.Sets.OrderBy(s => s.SetNumber).Select(s => s.Reps!.Value));
        }
    }

    [Fact]
    public async Task A_client_can_have_only_one_training_session_in_progress()
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var client = await TestData.ClientAsync(db, trainer.Id);

        db.TrainingLogs.Add(new TrainingLog { ClientId = client.Id, StartedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        db.TrainingLogs.Add(new TrainingLog { ClientId = client.Id, StartedAt = DateTime.UtcNow });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        db.ChangeTracker.Clear();

        // Una sesión completada no bloquea iniciar otra.
        var first = await db.TrainingLogs.SingleAsync(l => l.ClientId == client.Id);
        first.Status = TrainingLogStatus.Completed;
        first.CompletedAt = DateTime.UtcNow.AddMinutes(1);
        await db.SaveChangesAsync();
        db.TrainingLogs.Add(new TrainingLog { ClientId = client.Id, StartedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        Assert.Equal(2, await db.TrainingLogs.CountAsync(l => l.ClientId == client.Id));
    }

    public static TheoryData<string> InvalidRows => new()
    {
        "reps-min-greater-than-max", "rpe-out-of-range", "weight-without-unit", "zero-sets",
        "media-with-two-sources", "variant-of-itself", "assignment-ends-before-start", "two-primary-muscles",
        "measurement-zero"
    };

    [Theory]
    [MemberData(nameof(InvalidRows))]
    public async Task Database_rejects_invalid_data(string scenario)
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var exercise = await TestData.ExerciseAsync(db);
        var draft = await TestData.RoutineAsync(db, trainer.Id, exercise.Id, publish: false);
        var item = await db.RoutineExercises.SingleAsync(x => x.RoutineDay.RoutineVersionId == draft.Id);

        switch (scenario)
        {
            case "reps-min-greater-than-max": item.RepsMin = 12; item.RepsMax = 8; break;
            case "rpe-out-of-range": item.Rpe = 11m; break;
            case "weight-without-unit": item.SuggestedWeight = 40m; item.SuggestedWeightUnit = null; break;
            case "zero-sets": item.Sets = 0; break;
            case "media-with-two-sources":
                var file = new Domain.Files.StoredFile
                {
                    Id = Guid.NewGuid(), Purpose = Domain.Files.FilePurpose.ExerciseImage, UploadedByUserId = trainer.Id,
                    OriginalFileName = "a.jpg", ContentType = "image/jpeg", SizeBytes = 10, StorageKey = Guid.NewGuid().ToString()
                };
                db.ExerciseMedia.Add(new ExerciseMedia { ExerciseId = exercise.Id, MediaType = MediaType.Image, StoredFile = file, ExternalUrl = "https://example.com/v" });
                break;
            case "variant-of-itself":
                db.ExerciseVariants.Add(new ExerciseVariant { ExerciseId = exercise.Id, VariantExerciseId = exercise.Id });
                break;
            case "assignment-ends-before-start":
                var client = await TestData.ClientAsync(db, trainer.Id);
                db.RoutineAssignments.Add(new RoutineAssignment
                {
                    ClientId = client.Id, RoutineVersionId = draft.Id, AssignedByUserId = trainer.Id,
                    StartDate = new DateOnly(2026, 11, 10), EndDate = new DateOnly(2026, 11, 1)
                });
                break;
            case "two-primary-muscles":
                db.ExerciseMuscles.Add(new ExerciseMuscle { ExerciseId = exercise.Id, MuscleGroupId = 2, Role = MuscleRole.Primary });
                break;
            case "measurement-zero":
                var c = await TestData.ClientAsync(db, trainer.Id);
                db.Measurements.Add(new Measurement { ClientId = c.Id, MeasurementTypeId = 1, MeasuredOn = new DateOnly(2026, 11, 1), Value = 0, Unit = "kg", RecordedByUserId = trainer.Id });
                break;
        }

        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Client_email_is_unique_ignoring_case()
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var client = await TestData.ClientAsync(db, trainer.Id);

        db.Clients.Add(new Client { TrainerId = trainer.Id, FirstName = "Otra", LastName = "Persona", Email = client.Email.ToUpperInvariant() });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Deactivating_a_client_keeps_history_and_clients_cannot_be_hard_deleted_with_data()
    {
        await using var db = fx.CreateContext();
        var trainer = await TestData.UserAsync(db);
        var client = await TestData.ClientAsync(db, trainer.Id);
        db.Measurements.Add(new Measurement { ClientId = client.Id, MeasurementTypeId = 1, MeasuredOn = new DateOnly(2026, 10, 1), Value = 64.3m, Unit = "kg", RecordedByUserId = trainer.Id });
        db.TrainingLogs.Add(new TrainingLog { ClientId = client.Id, StartedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        client.Status = ClientStatus.Inactive;
        client.DeactivatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        Assert.Equal(1, await db.Measurements.CountAsync(m => m.ClientId == client.Id));
        Assert.Equal(1, await db.TrainingLogs.CountAsync(l => l.ClientId == client.Id));

        db.ChangeTracker.Clear();
        var sql = await Assert.ThrowsAsync<SqlException>(() => db.Clients.Where(c => c.Id == client.Id).ExecuteDeleteAsync());
        Assert.Equal(547, sql.Number);
    }

    [Fact]
    public async Task Dates_are_utc_decimals_keep_precision_and_timestamps_are_automatic()
    {
        int measurementId;
        DateTime createdAt;
        await using (var db = fx.CreateContext())
        {
            var trainer = await TestData.UserAsync(db);
            var client = await TestData.ClientAsync(db, trainer.Id);
            var m = new Measurement { ClientId = client.Id, MeasurementTypeId = 2, MeasuredOn = new DateOnly(2026, 10, 30), Value = 72.35m, Unit = "cm", RecordedByUserId = trainer.Id };
            db.Measurements.Add(m);
            await db.SaveChangesAsync();
            measurementId = m.Id;
            createdAt = m.CreatedAt;
            Assert.NotEqual(default, createdAt);
            Assert.Equal(DateTimeKind.Utc, createdAt.Kind);
        }

        await Task.Delay(20);
        await using (var db = fx.CreateContext())
        {
            var m = await db.Measurements.SingleAsync(x => x.Id == measurementId);
            Assert.Equal(72.35m, m.Value);
            Assert.Equal(new DateOnly(2026, 10, 30), m.MeasuredOn);
            Assert.Equal(DateTimeKind.Utc, m.CreatedAt.Kind);
            m.Notes = "Corrección";
            await db.SaveChangesAsync();
        }

        await using (var db = fx.CreateContext())
        {
            var m = await db.Measurements.AsNoTracking().SingleAsync(x => x.Id == measurementId);
            Assert.Equal(createdAt, m.CreatedAt, TimeSpan.FromMilliseconds(1));
            Assert.True(m.UpdatedAt > m.CreatedAt);
        }
    }
}
