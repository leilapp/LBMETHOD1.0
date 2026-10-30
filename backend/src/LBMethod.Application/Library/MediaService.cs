using LBMethod.Application.Abstractions;
using LBMethod.Domain.Audit;
using LBMethod.Domain.Exercises;
using LBMethod.Domain.Files;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.Application.Library;

public record MediaLimits(long MaxImageBytes, long MaxVideoBytes);

public record MediaContent(Stream Content, string ContentType, string FileName);

/// <summary>
/// Imágenes y videos de los ejercicios. Los archivos se guardan en almacenamiento privado con un nombre
/// aleatorio; el tipo se comprueba por su contenido real (no por la extensión) y se limita el tamaño.
/// También se aceptan enlaces externos (por ejemplo, un video no listado de YouTube).
/// </summary>
public class MediaService(IAppDbContext db, IFileStorage storage, ICurrentUser user, MediaLimits limits, TimeProvider clock)
{
    private static readonly (string ContentType, string Extension, MediaType Type, Func<byte[], bool> Matches)[] Signatures =
    [
        ("image/jpeg", ".jpg", MediaType.Image, b => b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF),
        ("image/png", ".png", MediaType.Image, b => b.Length >= 8 && b[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })),
        ("image/webp", ".webp", MediaType.Image, b => b.Length >= 12 && b[..4].SequenceEqual("RIFF"u8.ToArray()) && b[8..12].SequenceEqual("WEBP"u8.ToArray())),
        ("video/mp4", ".mp4", MediaType.Video, b => b.Length >= 12 && b[4..8].SequenceEqual("ftyp"u8.ToArray())),
        ("video/webm", ".webm", MediaType.Video, b => b.Length >= 4 && b[..4].SequenceEqual(new byte[] { 0x1A, 0x45, 0xDF, 0xA3 })),
    ];

    public async Task<LibraryResult> UploadAsync(int exerciseId, string fileName, Stream content, long length, string? title, CancellationToken ct = default)
    {
        if (!await db.Exercises.AnyAsync(e => e.Id == exerciseId, ct)) return LibraryResult.NotFound();
        if (length <= 0) return LibraryResult.Invalid("file", "El archivo está vacío.");

        var header = new byte[16];
        var read = await content.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct);
        var signature = Signatures.FirstOrDefault(s => s.Matches(header[..read]));
        if (signature.ContentType is null)
            return LibraryResult.Invalid("file", "Formato no permitido. Imágenes: JPG, PNG o WEBP. Videos: MP4 o WEBM.");

        var max = signature.Type == MediaType.Image ? limits.MaxImageBytes : limits.MaxVideoBytes;
        if (length > max)
            return LibraryResult.Invalid("file", $"El archivo supera el máximo de {max / (1024 * 1024)} MB para {(signature.Type == MediaType.Image ? "imágenes" : "videos")}.");

        content.Position = 0;
        var file = new StoredFile
        {
            Id = Guid.NewGuid(),
            Purpose = signature.Type == MediaType.Image ? FilePurpose.ExerciseImage : FilePurpose.ExerciseVideo,
            UploadedByUserId = user.UserId,
            OriginalFileName = SafeFileName(fileName, signature.Extension),
            ContentType = signature.ContentType,
            SizeBytes = length,
            StorageProvider = storage.ProviderName,
            CreatedAt = clock.GetUtcNow().UtcDateTime,
        };
        file.StorageKey = $"exercises/{file.Id:N}{signature.Extension}";
        await storage.SaveAsync(file.StorageKey, content, ct);

        try
        {
            var order = await db.ExerciseMedia.Where(m => m.ExerciseId == exerciseId).Select(m => (int?)m.SortOrder).MaxAsync(ct) ?? 0;
            var media = new ExerciseMedia
            {
                ExerciseId = exerciseId, MediaType = signature.Type, StoredFile = file,
                Title = NameNormalizer.CleanOptional(title), SortOrder = order + 1
            };
            db.ExerciseMedia.Add(media);
            Audit("ExerciseMediaUploaded", exerciseId);
            await db.SaveChangesAsync(ct);
            return LibraryResult.Ok(media.Id);
        }
        catch
        {
            await storage.DeleteAsync(file.StorageKey, ct); // no dejar archivos huérfanos
            throw;
        }
    }

    public async Task<LibraryResult> AddLinkAsync(int exerciseId, string url, MediaType type, string? title, CancellationToken ct = default)
    {
        if (!await db.Exercises.AnyAsync(e => e.Id == exerciseId, ct)) return LibraryResult.NotFound();
        if (!Enum.IsDefined(type)) return LibraryResult.Invalid("mediaType", "Tipo de medio no válido.");
        if (url.Length > 1000 || !Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            return LibraryResult.Invalid("url", "Escribe un enlace completo y seguro que empiece con https://");

        var order = await db.ExerciseMedia.Where(m => m.ExerciseId == exerciseId).Select(m => (int?)m.SortOrder).MaxAsync(ct) ?? 0;
        var media = new ExerciseMedia
        {
            ExerciseId = exerciseId, MediaType = type, ExternalUrl = uri.ToString(),
            Title = NameNormalizer.CleanOptional(title), SortOrder = order + 1
        };
        db.ExerciseMedia.Add(media);
        Audit("ExerciseMediaLinked", exerciseId);
        await db.SaveChangesAsync(ct);
        return LibraryResult.Ok(media.Id);
    }

    /// <summary>Quita el medio del ejercicio y elimina el archivo físico; los metadatos quedan marcados como borrados.</summary>
    public async Task<LibraryResult> DeleteAsync(int exerciseId, int mediaId, CancellationToken ct = default)
    {
        var media = await db.ExerciseMedia.Include(m => m.StoredFile).SingleOrDefaultAsync(m => m.Id == mediaId && m.ExerciseId == exerciseId, ct);
        if (media is null) return LibraryResult.NotFound();

        var file = media.StoredFile;
        db.ExerciseMedia.Remove(media);
        if (file is not null) file.DeletedAt = clock.GetUtcNow().UtcDateTime;
        Audit("ExerciseMediaDeleted", exerciseId);
        await db.SaveChangesAsync(ct);
        if (file is not null) await storage.DeleteAsync(file.StorageKey, ct);
        return LibraryResult.Ok(exerciseId);
    }

    public async Task<MediaContent?> OpenAsync(int mediaId, CancellationToken ct = default)
    {
        var file = await db.ExerciseMedia.Where(m => m.Id == mediaId && m.StoredFile != null && m.StoredFile.DeletedAt == null)
            .Select(m => m.StoredFile!).SingleOrDefaultAsync(ct);
        if (file is null) return null;
        var stream = await storage.OpenReadAsync(file.StorageKey, ct);
        return stream is null ? null : new MediaContent(stream, file.ContentType, file.OriginalFileName);
    }

    private static string SafeFileName(string name, string extension)
    {
        var baseName = Path.GetFileNameWithoutExtension(Path.GetFileName(name ?? string.Empty));
        var clean = new string(baseName.Where(c => char.IsLetterOrDigit(c) || c is ' ' or '-' or '_').ToArray()).Trim();
        if (clean.Length == 0) clean = "archivo";
        if (clean.Length > 100) clean = clean[..100];
        return clean + extension;
    }

    private void Audit(string action, int exerciseId) => db.AuditLogs.Add(new AuditLog
    {
        OccurredAt = clock.GetUtcNow().UtcDateTime, UserId = user.UserId, Action = action,
        EntityType = nameof(Exercise), EntityId = exerciseId.ToString()
    });
}
