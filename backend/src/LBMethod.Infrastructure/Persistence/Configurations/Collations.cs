namespace LBMethod.Infrastructure.Persistence.Configurations;

internal static class Collations
{
    /// <summary>
    /// Sin distinguir mayúsculas ni acentos: "Glúteo" y "gluteo" se consideran el mismo nombre,
    /// tanto para evitar duplicados (índices únicos) como para buscar.
    /// </summary>
    public const string CatalogNames = "Latin1_General_100_CI_AI";
}
