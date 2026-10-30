using LBMethod.Domain.Clients;
using LBMethod.Domain.Common;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Routines;
using LBMethod.Infrastructure.Identity;
using LBMethod.Infrastructure.Persistence;

namespace LBMethod.IntegrationTests;

/// <summary>Constructores de datos para las pruebas. Cada llamada usa nombres únicos.</summary>
internal static class TestData
{
    public static string Unique(string prefix) => $"{prefix}-{Guid.NewGuid():N}"[..Math.Min(prefix.Length + 13, 60)];

    public static async Task<AppUser> UserAsync(LBMethodDbContext db, string role = "trainer")
    {
        var email = $"{Unique(role)}@test.local";
        var user = new AppUser
        {
            UserName = email, NormalizedUserName = email.ToUpperInvariant(),
            Email = email, NormalizedEmail = email.ToUpperInvariant(),
            DisplayName = role, SecurityStamp = Guid.NewGuid().ToString()
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public static async Task<Client> ClientAsync(LBMethodDbContext db, int trainerId)
    {
        var client = new Client
        {
            TrainerId = trainerId, FirstName = "Cliente", LastName = "Prueba",
            Email = $"{Unique("client")}@test.local"
        };
        db.Clients.Add(client);
        await db.SaveChangesAsync();
        return client;
    }

    public static async Task<Exercise> ExerciseAsync(LBMethodDbContext db)
    {
        var exercise = new Exercise { NameEs = Unique("Hip thrust"), NameEn = Unique("Hip thrust en") };
        exercise.Muscles.Add(new ExerciseMuscle { MuscleGroupId = 1, Role = MuscleRole.Primary });
        db.Exercises.Add(exercise);
        await db.SaveChangesAsync();
        return exercise;
    }

    /// <summary>Rutina con una versión de un día y un ejercicio; opcionalmente publicada.</summary>
    public static async Task<RoutineVersion> RoutineAsync(LBMethodDbContext db, int trainerId, int exerciseId, bool publish)
    {
        var routine = new Routine { TrainerId = trainerId, Name = Unique("Rutina") };
        var version = new RoutineVersion
        {
            Routine = routine, VersionNumber = 1, Title = "Fuerza glúteo", Goal = "Hipertrofia",
            Status = publish ? RoutineVersionStatus.Published : RoutineVersionStatus.Draft,
            PublishedAt = publish ? DateTime.UtcNow : null, PublishedByUserId = publish ? trainerId : null
        };
        var day = new RoutineDay { Position = 1, Name = "Día 1 - Pierna", DayOfWeek = DayOfWeek.Monday };
        day.Exercises.Add(new RoutineExercise
        {
            ExerciseId = exerciseId, Position = 1, Sets = 4, RepsMin = 8, RepsMax = 12,
            SuggestedWeight = 60m, SuggestedWeightUnit = WeightUnit.Kg, RestSeconds = 90,
            Tempo = "3-1-1-0", Rir = 2m, Notes = "Pausa arriba"
        });
        version.Days.Add(day);
        db.RoutineVersions.Add(version);
        await db.SaveChangesAsync();
        return version;
    }
}
