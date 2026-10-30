namespace LBMethod.Domain.Common;

/// <summary>
/// Zona horaria del negocio: centro de México (Guanajuato), "America/Mexico_City".
/// La base de datos guarda instantes en UTC; esta clase los convierte a fecha y hora locales
/// para mostrarlos y para decidir a qué día de calendario pertenece un entrenamiento.
/// </summary>
public static class BusinessTime
{
    public const string TimeZoneId = "America/Mexico_City";

    public static TimeZoneInfo TimeZone { get; } = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

    public static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZone);

    public static DateOnly LocalDate(DateTime utc) => DateOnly.FromDateTime(ToLocal(utc));
}
