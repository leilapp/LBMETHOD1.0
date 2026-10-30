namespace LBMethod.Domain.Files;

public enum FilePurpose
{
    ExerciseImage = 1,
    ExerciseVideo = 2,
    ProgressPhoto = 3,
    Import = 4,
    Export = 5
}

/// <summary>
/// Metadatos de un archivo privado. El archivo físico vive fuera de cualquier carpeta pública,
/// identificado por StorageKey; solo se entrega a través de un endpoint autenticado que valida permisos.
/// </summary>
public class StoredFile
{
    public Guid Id { get; set; }
    public FilePurpose Purpose { get; set; }

    /// <summary>Cliente propietario cuando el archivo es suyo (fotos de progreso). Nulo para medios de la biblioteca.</summary>
    public int? OwnerClientId { get; set; }
    public int UploadedByUserId { get; set; }

    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? Sha256 { get; set; }

    /// <summary>Proveedor de almacenamiento (por ahora "Local"); permite migrar a la nube sin cambiar el modelo.</summary>
    public string StorageProvider { get; set; } = "Local";
    public string StorageKey { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}
