namespace LBMethod.Domain.Common;

/// <summary>Unidad de carga o de peso corporal. Se guarda junto a cada valor para no mezclar unidades.</summary>
public enum WeightUnit
{
    Kg = 1,
    Lb = 2
}

/// <summary>Unidad de longitud para estatura y medidas corporales.</summary>
public enum LengthUnit
{
    Cm = 1,
    In = 2
}

/// <summary>Días de la semana combinables (por ejemplo, días disponibles del cliente).</summary>
[Flags]
public enum WeekDays
{
    None = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 4,
    Thursday = 8,
    Friday = 16,
    Saturday = 32,
    Sunday = 64
}

/// <summary>Tipo de serie, prescrita o realizada.</summary>
public enum SetType
{
    Working = 1,
    Warmup = 2,
    Dropset = 3,
    Failure = 4,
    RestPause = 5,
    Backoff = 6,
    Other = 99
}
