using LBMethod.Domain.Exercises;
using LBMethod.Domain.Tracking;

namespace LBMethod.Infrastructure.Persistence.Seed;

/// <summary>
/// Catálogos iniciales definidos en la guía maestra (no son datos de ejemplo).
/// La entrenadora puede editarlos o agregar más desde la aplicación.
/// </summary>
internal static class ReferenceData
{
    private static readonly DateTime SeedDate = new(2026, 10, 30, 0, 0, 0, DateTimeKind.Utc);

    public static readonly MuscleGroup[] MuscleGroups =
    [
        Muscle(1, "Glúteos", "Glutes"),
        Muscle(2, "Femoral", "Hamstrings"),
        Muscle(3, "Cuádriceps", "Quadriceps"),
        Muscle(4, "Abductores", "Abductors"),
        Muscle(5, "Aductores", "Adductors"),
        Muscle(6, "Pantorrillas", "Calves"),
        Muscle(7, "Espalda", "Back"),
        Muscle(8, "Pecho", "Chest"),
        Muscle(9, "Hombros", "Shoulders"),
        Muscle(10, "Bíceps", "Biceps"),
        Muscle(11, "Tríceps", "Triceps"),
        Muscle(12, "Abdomen", "Abs"),
    ];

    // Unidades métricas por defecto; editables por la entrenadora.
    public static readonly MeasurementType[] MeasurementTypes =
    [
        Measure(1, "Peso corporal", "Body weight", MeasurementKind.BodyWeight, "kg"),
        Measure(2, "Cintura", "Waist", MeasurementKind.Circumference, "cm"),
        Measure(3, "Cadera", "Hips", MeasurementKind.Circumference, "cm"),
        Measure(4, "Glúteos", "Glutes", MeasurementKind.Circumference, "cm"),
        Measure(5, "Muslo", "Thigh", MeasurementKind.Circumference, "cm"),
        Measure(6, "Brazo", "Arm", MeasurementKind.Circumference, "cm"),
        Measure(7, "Pantorrilla", "Calf", MeasurementKind.Circumference, "cm"),
    ];

    private static MuscleGroup Muscle(int id, string es, string en) => new()
    {
        Id = id, NameEs = es, NameEn = en, SortOrder = id, IsActive = true, CreatedAt = SeedDate, UpdatedAt = SeedDate
    };

    private static MeasurementType Measure(int id, string es, string en, MeasurementKind kind, string unit) => new()
    {
        Id = id, NameEs = es, NameEn = en, Kind = kind, Unit = unit, SortOrder = id, IsActive = true, CreatedAt = SeedDate, UpdatedAt = SeedDate
    };
}
