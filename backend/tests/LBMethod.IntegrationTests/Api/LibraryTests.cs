using System.Net;
using System.Net.Http.Json;
using ClosedXML.Excel;
using LBMethod.Api.Contracts;
using LBMethod.Application.Library;
using Microsoft.EntityFrameworkCore;

namespace LBMethod.IntegrationTests.Api;

public class LibraryTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string Base = "/api/trainer/library";
    private static readonly byte[] PngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 0x49, 0x48, 0x44, 0x52];
    private static readonly byte[] Mp4Header = [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D, 0, 0, 0, 0];

    private async Task<ApiSession> TrainerAsync()
    {
        var email = await api.CreateTrainerAsync();
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
        return session;
    }

    private static object Exercise(string nameEs, string? nameEn = null, int primary = 1, int[]? secondary = null,
        int[]? equipment = null, int? pattern = null, int type = 1) => new
    {
        nameEs, nameEn, description = "Descripción", instructions = "Paso 1", commonMistakes = "Arquear la espalda",
        technicalTips = "Apretar glúteo arriba", type, difficulty = 2, movementPatternId = pattern,
        primaryMuscleGroupId = primary, secondaryMuscleGroupIds = secondary ?? [], equipmentIds = equipment ?? []
    };

    private static async Task<int> CreatedId(HttpResponseMessage res)
    {
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<IdResponse>())!.Id;
    }

    private static string U(string prefix) => TestData.Unique(prefix);

    private static byte[] Bytes(byte[] header, int size)
    {
        var data = new byte[size];
        header.CopyTo(data, 0);
        return data;
    }

    [Fact]
    public async Task Trainer_creates_edits_and_views_an_exercise_with_muscles_equipment_and_pattern()
    {
        using var t = await TrainerAsync();
        var eq = await CreatedId(await t.PostAsync($"{Base}/equipment", new { nameEs = U("Barra"), nameEn = U("Barbell") }));
        var pattern = await CreatedId(await t.PostAsync($"{Base}/movement-patterns", new { nameEs = U("Bisagra"), nameEn = U("Hinge") }));
        var name = U("Hip thrust con barra");

        var id = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise(name, U("Barbell hip thrust"), 1, [2, 4], [eq], pattern)));
        var detail = (await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{id}"))!;
        Assert.Equal(name, detail.NameEs);
        Assert.Equal(1, detail.PrimaryMuscleGroup!.Id);
        Assert.Equal([2, 4], detail.SecondaryMuscleGroups.Select(m => m.Id).Order());
        Assert.Equal(eq, Assert.Single(detail.Equipment).Id);
        Assert.Equal(pattern, detail.MovementPattern!.Id);
        Assert.Equal("Fuerza", detail.TypeLabel);
        Assert.Equal("Intermedio", detail.DifficultyLabel);

        // Cambiar el músculo principal a uno que era secundario, y quitar el equipamiento.
        var update = await t.PutAsync($"{Base}/exercises/{id}", Exercise(name + " editado", null, 2, [1], [], null, 5));
        Assert.Equal(HttpStatusCode.NoContent, update.StatusCode);
        detail = (await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{id}"))!;
        Assert.Equal(2, detail.PrimaryMuscleGroup!.Id);
        Assert.Equal(1, Assert.Single(detail.SecondaryMuscleGroups).Id);
        Assert.Empty(detail.Equipment);
        Assert.Null(detail.MovementPattern);
        Assert.Null(detail.NameEn);
        Assert.Equal("Isométrico", detail.TypeLabel);

        await using var db = api.NewDbContext();
        Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == "ExerciseUpdated" && a.EntityId == id.ToString()));
    }

    [Fact]
    public async Task Invalid_exercise_data_is_rejected_with_field_messages()
    {
        using var t = await TrainerAsync();
        var res = await t.PostAsync($"{Base}/exercises", Exercise(U("Sentadilla"), primary: 999));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("primaryMuscleGroupId", await res.Content.ReadAsStringAsync());

        res = await t.PostAsync($"{Base}/exercises", Exercise(U("Sentadilla"), primary: 1, secondary: [1]));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);

        res = await t.PostAsync($"{Base}/exercises", new { nameEs = "", type = 1, primaryMuscleGroupId = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Duplicate_names_are_rejected_ignoring_case_accents_spaces_and_language()
    {
        using var t = await TrainerAsync();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Sentadilla Búlgara {suffix}", $"Bulgarian split squat {suffix}")));

        foreach (var (es, en) in new[]
                 {
                     ($"sentadilla bulgara {suffix}", (string?)null),
                     ($"  SENTADILLA   BÚLGARA {suffix} ", null),
                     ($"Otra {suffix}", $"bulgarian SPLIT squat {suffix}"),
                     ($"Bulgarian split squat {suffix}", null), // el nombre en español coincide con el inglés de otro
                 })
        {
            var res = await t.PostAsync($"{Base}/exercises", Exercise(es, en));
            Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        }
    }

    [Fact]
    public async Task Search_works_in_spanish_or_english_without_accents_and_filters_combine()
    {
        using var t = await TrainerAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var eq = await CreatedId(await t.PostAsync($"{Base}/equipment", new { nameEs = U("Mancuerna"), nameEn = U("Dumbbell") }));
        var pattern = await CreatedId(await t.PostAsync($"{Base}/movement-patterns", new { nameEs = U("Zancada"), nameEn = U("Lunge") }));
        var a = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Elevación de cadera {tag}", $"Glute bridge {tag}", 1, equipment: [eq])));
        var b = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Zancada búlgara {tag}", $"Split squat {tag}", 3, [1], pattern: pattern)));
        await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Press de pecho {tag}", null, 8)));

        async Task<int[]> Ids(string query) =>
            (await t.Http.GetFromJsonAsync<PagedResponse<ExerciseListItemResponse>>($"{Base}/exercises?{query}"))!.Items.Select(i => i.Id).Order().ToArray();

        Assert.Equal([a], await Ids($"q=elevacion de cadera {tag}"));
        Assert.Equal([a], await Ids($"q=GLUTE BRIDGE {tag}"));
        Assert.Equal([b], await Ids($"q=bulgara {tag}"));
        Assert.Equal([a, b], await Ids($"q={tag}&muscleGroupId=1"));
        Assert.Equal([a], await Ids($"q={tag}&equipmentId={eq}"));
        Assert.Equal([b], await Ids($"q={tag}&movementPatternId={pattern}"));
        Assert.Equal([b], await Ids($"q={tag}&muscleGroupId=1&movementPatternId={pattern}"));
    }

    [Fact]
    public async Task Deactivating_hides_the_exercise_but_keeps_routines_and_it_can_be_reactivated()
    {
        using var t = await TrainerAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var id = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Peso muerto rumano {tag}")));

        int versionId;
        await using (var db = api.NewDbContext())
        {
            var trainer = await TestData.UserAsync(db);
            versionId = (await TestData.RoutineAsync(db, trainer.Id, id, publish: true)).Id;
        }

        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Base}/exercises/{id}/status", new { active = false })).StatusCode);
        var active = await t.Http.GetFromJsonAsync<PagedResponse<ExerciseListItemResponse>>($"{Base}/exercises?q={tag}");
        Assert.Empty(active!.Items);
        var inactive = await t.Http.GetFromJsonAsync<PagedResponse<ExerciseListItemResponse>>($"{Base}/exercises?q={tag}&status=inactive");
        Assert.Equal(id, Assert.Single(inactive!.Items).Id);

        await using (var db = api.NewDbContext())
        {
            var routineExercise = await db.RoutineExercises.Include(r => r.Exercise).SingleAsync(r => r.RoutineDay.RoutineVersionId == versionId);
            Assert.Equal(id, routineExercise.ExerciseId);
            Assert.False(routineExercise.Exercise.IsActive);
            Assert.NotNull(routineExercise.Exercise.DeactivatedAt);
        }

        // Desactivado sigue contando para evitar duplicados.
        Assert.Equal(HttpStatusCode.Conflict, (await t.PostAsync($"{Base}/exercises", Exercise($"Peso muerto rumano {tag}"))).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Base}/exercises/{id}/status", new { active = true })).StatusCode);
        var detail = await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{id}");
        Assert.True(detail!.IsActive);
        Assert.Null(detail.DeactivatedAt);
    }

    [Fact]
    public async Task Favorites_are_per_user_and_can_be_filtered()
    {
        using var t = await TrainerAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var a = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Favorito A {tag}")));
        await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Favorito B {tag}")));

        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Base}/exercises/{a}/favorite")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Base}/exercises/{a}/favorite")).StatusCode); // repetir no falla
        var favs = await t.Http.GetFromJsonAsync<PagedResponse<ExerciseListItemResponse>>($"{Base}/exercises?q={tag}&favorites=true");
        Assert.Equal(a, Assert.Single(favs!.Items).Id);
        Assert.True(favs.Items[0].IsFavorite);

        using var other = await TrainerAsync();
        var otherFavs = await other.Http.GetFromJsonAsync<PagedResponse<ExerciseListItemResponse>>($"{Base}/exercises?q={tag}&favorites=true");
        Assert.Empty(otherFavs!.Items);

        Assert.Equal(HttpStatusCode.NoContent, (await t.DeleteAsync($"{Base}/exercises/{a}/favorite")).StatusCode);
        favs = await t.Http.GetFromJsonAsync<PagedResponse<ExerciseListItemResponse>>($"{Base}/exercises?q={tag}&favorites=true");
        Assert.Empty(favs!.Items);
    }

    [Fact]
    public async Task Variants_link_two_distinct_exercises_in_both_directions()
    {
        using var t = await TrainerAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var main = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Hip thrust {tag}")));
        var variant = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Hip thrust unilateral {tag}")));

        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Base}/exercises/{main}/variants", new { variantExerciseId = variant, note = "Una pierna" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await t.PostAsync($"{Base}/exercises/{variant}/variants", new { variantExerciseId = main })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await t.PostAsync($"{Base}/exercises/{main}/variants", new { variantExerciseId = main })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await t.PostAsync($"{Base}/exercises/{main}/variants", new { variantExerciseId = 999999 })).StatusCode);

        var fromMain = await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{main}");
        var fromVariant = await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{variant}");
        Assert.Equal(variant, Assert.Single(fromMain!.Variants).ExerciseId);
        Assert.Equal("Una pierna", fromMain.Variants[0].Note);
        Assert.Equal(main, Assert.Single(fromVariant!.Variants).ExerciseId);

        Assert.Equal(HttpStatusCode.NoContent, (await t.DeleteAsync($"{Base}/exercises/{variant}/variants/{main}")).StatusCode);
        fromMain = await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{main}");
        Assert.Empty(fromMain!.Variants);
    }

    [Fact]
    public async Task Image_upload_is_private_validated_by_content_and_deleted_completely()
    {
        using var t = await TrainerAsync();
        var id = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise(U("Con imagen"))));
        var png = Bytes(PngHeader, 2048);

        var mediaId = await CreatedId(await t.UploadAsync($"{Base}/exercises/{id}/media", png, "../../foto ejemplo.png", new Dictionary<string, string> { ["title"] = "Posición final" }));
        var detail = await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{id}");
        var media = Assert.Single(detail!.Media);
        Assert.Equal("Image", media.MediaType);
        Assert.Equal("foto ejemplo.png", media.FileName);
        Assert.Equal($"/api/trainer/library/media/{mediaId}/content", media.ContentUrl);

        var content = await t.GetAsync(media.ContentUrl!);
        Assert.Equal(HttpStatusCode.OK, content.StatusCode);
        Assert.Equal("image/png", content.Content.Headers.ContentType!.MediaType);
        Assert.Equal(png, await content.Content.ReadAsByteArrayAsync());
        Assert.Contains("no-store", content.Headers.CacheControl!.ToString());

        // Solo existe dentro de la carpeta privada, con nombre aleatorio.
        string storedKey;
        await using (var db = api.NewDbContext())
            storedKey = (await db.ExerciseMedia.Include(m => m.StoredFile).SingleAsync(m => m.Id == mediaId)).StoredFile!.StorageKey;
        Assert.DoesNotContain("foto", storedKey);
        Assert.True(File.Exists(Path.Combine(api.StoragePath, storedKey)));

        // Sin sesión no hay acceso.
        using var anon = api.NewSession();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync(media.ContentUrl!)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await t.DeleteAsync($"{Base}/exercises/{id}/media/{mediaId}")).StatusCode);
        Assert.False(File.Exists(Path.Combine(api.StoragePath, storedKey)));
        Assert.Equal(HttpStatusCode.NotFound, (await t.GetAsync(media.ContentUrl!)).StatusCode);
        await using (var db = api.NewDbContext())
            Assert.NotNull((await db.StoredFiles.SingleAsync(f => f.StorageKey == storedKey)).DeletedAt);
    }

    [Fact]
    public async Task Uploads_with_wrong_type_or_too_large_are_rejected()
    {
        using var t = await TrainerAsync();
        var id = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise(U("Validación medios"))));

        // Un archivo de texto renombrado como imagen.
        var fake = "<script>alert(1)</script>"u8.ToArray();
        var res = await t.UploadAsync($"{Base}/exercises/{id}/media", fake, "foto.png");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("Formato no permitido", await res.Content.ReadAsStringAsync());

        res = await t.UploadAsync($"{Base}/exercises/{id}/media", Bytes(PngHeader, 5 * 1024 * 1024 + 1), "grande.png");
        var body = await res.Content.ReadAsStringAsync();
        Assert.True(res.StatusCode == HttpStatusCode.BadRequest && body.Contains("5 MB"), body);

        // En pruebas el máximo de video es 2 MB.
        Assert.Equal(HttpStatusCode.Created, (await t.UploadAsync($"{Base}/exercises/{id}/media", Bytes(Mp4Header, 1024 * 1024), "video.mp4")).StatusCode);
        res = await t.UploadAsync($"{Base}/exercises/{id}/media", Bytes(Mp4Header, 2 * 1024 * 1024 + 1), "video.mp4");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await t.UploadAsync($"{Base}/exercises/999999/media", Bytes(PngHeader, 100), "a.png")).StatusCode);
    }

    [Fact]
    public async Task External_links_must_be_https()
    {
        using var t = await TrainerAsync();
        var id = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise(U("Con enlace"))));
        await CreatedId(await t.PostAsync($"{Base}/exercises/{id}/media/link", new { url = "https://www.youtube.com/watch?v=abc", mediaType = 2, title = "Demostración" }));
        foreach (var url in new[] { "http://inseguro.com/v", "javascript:alert(1)", "no es enlace" })
            Assert.Equal(HttpStatusCode.BadRequest, (await t.PostAsync($"{Base}/exercises/{id}/media/link", new { url, mediaType = 2 })).StatusCode);

        var detail = await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{id}");
        var media = Assert.Single(detail!.Media);
        Assert.Null(media.ContentUrl);
        Assert.Equal("https://www.youtube.com/watch?v=abc", media.ExternalUrl);
    }

    [Fact]
    public async Task Clients_cannot_use_the_library_endpoints()
    {
        using var t = await TrainerAsync();
        var created = await t.PostAsync("/api/trainer/clients", new { firstName = "Ana", lastName = "Cliente", email = $"{U("cli")}@test.local" });
        var temp = (await created.Content.ReadFromJsonAsync<TemporaryPasswordResponse>())!;
        string email;
        await using (var db = api.NewDbContext()) email = db.Clients.Single(c => c.Id == temp.ClientId).Email;
        using var client = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await client.LoginAsync(email, temp.TemporaryPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/change-password", new { currentPassword = temp.TemporaryPassword, newPassword = "MiClaveNueva2026" })).StatusCode);
        await client.RefreshCsrfAsync();

        var id = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise(U("Privado"))));
        var mediaId = await CreatedId(await t.UploadAsync($"{Base}/exercises/{id}/media", Bytes(PngHeader, 100), "a.png"));

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Base}/exercises")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Base}/media/{mediaId}/content")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync($"{Base}/exercises", Exercise(U("Intruso")))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Base}/exercises/export")).StatusCode);
    }

    [Fact]
    public async Task Trainer_manages_muscle_groups_equipment_and_patterns_without_duplicates()
    {
        using var t = await TrainerAsync();
        var name = U("Core profundo");
        var id = await CreatedId(await t.PostAsync($"{Base}/muscle-groups", new { nameEs = name, nameEn = U("Deep core") }));
        Assert.Equal(HttpStatusCode.Conflict, (await t.PostAsync($"{Base}/muscle-groups", new { nameEs = name.ToUpperInvariant(), nameEn = U("Other") })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await t.PostAsync($"{Base}/muscle-groups", new { nameEs = U("Otro"), nameEn = "Glutes" })).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Base}/muscle-groups/{id}", new { nameEs = name + " editado", nameEn = U("Deep core 2"), isActive = false })).StatusCode);
        var catalogs = await t.Http.GetFromJsonAsync<LibraryCatalogsResponse>($"{Base}/catalogs");
        var edited = catalogs!.MuscleGroups.Single(m => m.Id == id);
        Assert.False(edited.IsActive);
        Assert.Equal(12, catalogs.MuscleGroups.Count(m => m.Id <= 12)); // los iniciales siguen ahí
        Assert.Equal(7, catalogs.Types.Count);
        Assert.Equal(3, catalogs.Difficulties.Count);

        Assert.Equal(HttpStatusCode.NotFound, (await t.PutAsync($"{Base}/equipment/999999", new { nameEs = "x", nameEn = "y" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await t.PostAsync($"{Base}/movement-patterns", new { nameEs = "", nameEn = "Push" })).StatusCode);
    }

    [Fact]
    public async Task Template_downloads_with_headers_and_catalog_sheet()
    {
        using var t = await TrainerAsync();
        var res = await t.GetAsync($"{Base}/exercises/import/template");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", res.Content.Headers.ContentType!.MediaType);
        using var wb = new XLWorkbook(await res.Content.ReadAsStreamAsync());
        Assert.Equal("NombreES", wb.Worksheet("Ejercicios").Cell(1, 1).GetString());
        Assert.Equal("Glúteos", wb.Worksheet("Catálogos").Cell(2, 1).GetString());
        Assert.True(wb.Worksheets.Contains("Instrucciones"));
    }

    [Fact]
    public async Task Import_previews_rows_then_saves_only_valid_ones_and_reports_rejected()
    {
        using var t = await TrainerAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var eqName = $"Banco {tag}";
        await CreatedId(await t.PostAsync($"{Base}/equipment", new { nameEs = eqName, nameEn = $"Bench {tag}" }));
        await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Existente {tag}")));

        var file = Workbook(
            [$"Hip thrust en banco {tag}", $"Bench hip thrust {tag}", "Glúteos", "femoral; abductores", eqName.ToUpperInvariant(), "Fuerza", "", "intermedio"],
            [$"Puente {tag}", "", "gluteos", "", "", "Isometrico", "", ""],
            [$"existente {tag}", "", "Glúteos", "", "", "Fuerza", "", ""],                 // ya existe en la biblioteca
            [$"Hip thrust en banco {tag}", "", "Glúteos", "", "", "Fuerza", "", ""],       // repetido dentro del archivo
            [$"Sin grupo {tag}", "", "", "", "", "Fuerza", "", ""],                        // falta grupo principal
            [$"Músculo raro {tag}", "", "Antebrazo", "", "Kettlebell inventada", "Fuerza", "", ""],
            [$"Tipo raro {tag}", "", "Glúteos", "", "", "Yoga", "", "Experto"]);

        var preview = await t.UploadAsync($"{Base}/exercises/import/preview", file, "ejercicios.xlsx");
        Assert.Equal(HttpStatusCode.OK, preview.StatusCode);
        var p = (await preview.Content.ReadFromJsonAsync<ImportPreviewDto>())!;
        Assert.Equal(7, p.Rows.Count);
        Assert.Equal(2, p.Valid);
        Assert.Equal(2, p.Duplicates);
        Assert.Equal(3, p.Errors);
        Assert.Equal(ImportRowStatus.Duplicate, p.Rows.Single(r => r.RowNumber == 5).Status);
        Assert.Contains("fila 2", p.Rows.Single(r => r.RowNumber == 5).Messages[0]);
        Assert.Contains(p.Rows.Single(r => r.RowNumber == 7).Messages, m => m.Contains("Antebrazo"));
        Assert.Contains(p.Rows.Single(r => r.RowNumber == 7).Messages, m => m.Contains("Kettlebell inventada"));

        // La vista previa no guarda nada.
        var list = await t.Http.GetFromJsonAsync<PagedResponse<ExerciseListItemResponse>>($"{Base}/exercises?q={tag}");
        Assert.Single(list!.Items);

        var commit = await t.UploadAsync($"{Base}/exercises/import/commit", file, "ejercicios.xlsx");
        Assert.Equal(HttpStatusCode.OK, commit.StatusCode);
        var report = (await commit.Content.ReadFromJsonAsync<ImportReportDto>())!;
        Assert.Equal(2, report.Created);
        Assert.Equal([4, 5, 6, 7, 8], report.Rejected.Select(r => r.RowNumber));

        list = await t.Http.GetFromJsonAsync<PagedResponse<ExerciseListItemResponse>>($"{Base}/exercises?q={tag}");
        Assert.Equal(3, list!.Items.Count);
        var imported = list.Items.Single(i => i.NameEs == $"Hip thrust en banco {tag}");
        var detail = await t.Http.GetFromJsonAsync<ExerciseDetailResponse>($"{Base}/exercises/{imported.Id}");
        Assert.Equal([2, 4], detail!.SecondaryMuscleGroups.Select(m => m.Id).Order());
        Assert.Equal(eqName, Assert.Single(detail.Equipment).NameEs);
        Assert.Equal("Intermedio", detail.DifficultyLabel);

        // Importar el mismo archivo otra vez no duplica nada.
        report = (await (await t.UploadAsync($"{Base}/exercises/import/commit", file, "ejercicios.xlsx")).Content.ReadFromJsonAsync<ImportReportDto>())!;
        Assert.Equal(0, report.Created);
    }

    [Fact]
    public async Task Import_rejects_files_that_are_not_the_template()
    {
        using var t = await TrainerAsync();
        var res = await t.UploadAsync($"{Base}/exercises/import/preview", "hola"u8.ToArray(), "texto.xlsx");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("Excel", await res.Content.ReadAsStringAsync());

        using var wb = new XLWorkbook();
        wb.AddWorksheet("Hoja1").Cell(1, 1).SetValue("Columna");
        res = await t.UploadAsync($"{Base}/exercises/import/preview", Save(wb), "otro.xlsx");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("Faltan columnas obligatorias", await res.Content.ReadAsStringAsync());

        res = await t.UploadAsync($"{Base}/exercises/import/preview", "a"u8.ToArray(), "datos.csv");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Export_contains_the_catalog_with_status()
    {
        using var t = await TrainerAsync();
        var tag = Guid.NewGuid().ToString("N")[..8];
        var id = await CreatedId(await t.PostAsync($"{Base}/exercises", Exercise($"Exportado {tag}", $"Exported {tag}", 1, [2])));
        await t.PostAsync($"{Base}/exercises/{id}/status", new { active = false });

        var res = await t.GetAsync($"{Base}/exercises/export");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        using var wb = new XLWorkbook(await res.Content.ReadAsStreamAsync());
        var sheet = wb.Worksheet("Ejercicios");
        var row = sheet.RowsUsed().Single(r => r.Cell(1).GetString() == $"Exportado {tag}");
        Assert.Equal($"Exported {tag}", row.Cell(2).GetString());
        Assert.Equal("Glúteos", row.Cell(4).GetString());
        Assert.Equal("Femoral", row.Cell(5).GetString());
        Assert.Equal("Fuerza", row.Cell(7).GetString());
        Assert.Equal("No", row.Cell(13).GetString());

        using var activeOnly = new XLWorkbook(await (await t.GetAsync($"{Base}/exercises/export?status=active")).Content.ReadAsStreamAsync());
        Assert.DoesNotContain(activeOnly.Worksheet("Ejercicios").RowsUsed(), r => r.Cell(1).GetString() == $"Exportado {tag}");
    }

    private static byte[] Workbook(params string[][] rows)
    {
        using var wb = new XLWorkbook();
        var sheet = wb.AddWorksheet("Ejercicios");
        string[] headers = ["NombreES", "NombreEN", "GrupoPrincipal", "MusculosSecundarios", "Equipamiento", "Tipo", "PatronMovimiento", "Dificultad"];
        for (var c = 0; c < headers.Length; c++) sheet.Cell(1, c + 1).SetValue(headers[c]);
        for (var r = 0; r < rows.Length; r++)
            for (var c = 0; c < rows[r].Length; c++)
                sheet.Cell(r + 2, c + 1).SetValue(rows[r][c]);
        return Save(wb);
    }

    private static byte[] Save(XLWorkbook wb)
    {
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private record ImportPreviewDto(List<ImportRowResult> Rows, int Valid, int Duplicates, int Errors);
    private record ImportReportDto(int Created, List<ImportRowResult> Rejected);
}
