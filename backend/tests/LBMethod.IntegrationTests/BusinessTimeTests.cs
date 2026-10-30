using LBMethod.Domain.Common;

namespace LBMethod.IntegrationTests;

public class BusinessTimeTests
{
    [Fact]
    public void Utc_instants_are_shown_in_central_mexico_time()
    {
        // México no aplica horario de verano desde 2022: centro del país = UTC-6 todo el año.
        Assert.Equal(new DateTime(2026, 7, 15, 6, 0, 0), BusinessTime.ToLocal(new DateTime(2026, 7, 15, 12, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(new DateTime(2026, 12, 15, 6, 0, 0), BusinessTime.ToLocal(new DateTime(2026, 12, 15, 12, 0, 0, DateTimeKind.Utc)));
    }

    [Fact]
    public void Late_evening_training_belongs_to_the_local_calendar_day()
    {
        // 31 de octubre 02:30 UTC = 30 de octubre 20:30 en Guanajuato.
        Assert.Equal(new DateOnly(2026, 10, 30), BusinessTime.LocalDate(new DateTime(2026, 10, 31, 2, 30, 0, DateTimeKind.Utc)));
    }
}
