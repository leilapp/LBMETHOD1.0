using System.Net;
using System.Net.Http.Json;
using ClosedXML.Excel;
using LBMethod.Api.Contracts;
using LBMethod.Domain.Common;
using Microsoft.EntityFrameworkCore;
using PdfSharp.Pdf.IO;

namespace LBMethod.IntegrationTests.Api;

public class ExportsTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string Trainer = "/api/trainer";
    private const string Portal = "/api/portal";
    private static readonly DateOnly Today = BusinessTime.LocalDate(DateTime.UtcNow);

    private async Task<ApiSession> TrainerAsync()
    {
        var email = await api.CreateTrainerAsync();
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, ApiFactory.TrainerPassword)).StatusCode);
        return session;
    }

    private async Task<(ApiSession Session, int ClientId)> ClientAsync(ApiSession trainer, string name)
    {
        var res = await trainer.PostAsync($"{Trainer}/clients", new { firstName = name, lastName = "Peña", email = $"{TestData.Unique("cli")}@test.local" });
        var created = (await res.Content.ReadFromJsonAsync<TemporaryPasswordResponse>())!;
        string email;
        await using (var db = api.NewDbContext()) email = db.Clients.Single(c => c.Id == created.ClientId).Email;
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.OK, (await session.LoginAsync(email, created.TemporaryPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await session.PostAsync("/api/auth/change-password", new { currentPassword = created.TemporaryPassword, newPassword = "MiClaveNueva2026" })).StatusCode);
        await session.RefreshCsrfAsync();
        return (session, created.ClientId);
    }

    private static async Task<int> IdOf(HttpResponseMessage res, HttpStatusCode expected)
    {
        Assert.True(res.StatusCode == expected, $"{res.StatusCode}: {await res.Content.ReadAsStringAsync()}");
        return (await res.Content.ReadFromJsonAsync<IdResponse>())!.Id;
    }

    /// <summary>Rutina publicada con <paramref name="days"/> días de 8 ejercicios cada uno (para forzar varias páginas).</summary>
    private static async Task<(int RoutineId, int VersionId, string Title)> RoutineAsync(ApiSession t, int days)
    {
        var ex = await IdOf(await t.PostAsync($"{Trainer}/library/exercises", new
        {
            nameEs = TestData.Unique("Extensión de cadera en máquina"), nameEn = TestData.Unique("Hip extension"), type = 1, primaryMuscleGroupId = 1,
            secondaryMuscleGroupIds = Array.Empty<int>(), equipmentIds = Array.Empty<int>()
        }), HttpStatusCode.Created);
        var title = TestData.Unique("Glúteo y pierna — señal");
        var routineId = await IdOf(await t.PostAsync($"{Trainer}/routines", new { kind = 1, title, goal = "Fuerza e hipertrofia", durationWeeks = 6 }), HttpStatusCode.Created);
        var draftId = await IdOf(await t.PostAsync($"{Trainer}/routines/{routineId}/draft"), HttpStatusCode.OK);
        var dayList = Enumerable.Range(1, days).Select(d => new
        {
            name = $"Día {d} · Pierna", dayOfWeek = (int?)(d % 7), notes = "Calentamiento: 10 minutos de caminadora",
            exercises = Enumerable.Range(1, 8).Select(i => (object)new
            {
                exerciseId = ex, sets = 3, repsMin = 8, repsMax = 12, suggestedWeight = 42.5m, suggestedWeightUnit = 1, restSeconds = 90, tempo = "3-1-1",
                rir = 2m, setType = 1, supersetGroup = i <= 2 ? "A" : null, notes = i == 1 ? "Pausa de un segundo arriba; espalda neutra" : null,
                setDetails = i == 3
                    ? new object[]
                    {
                        new { setType = 2, repsMin = 12, repsMax = 12, suggestedWeight = 20m, suggestedWeightUnit = 1, restSeconds = 60 },
                        new { setType = 1, repsMin = 8, repsMax = 8, suggestedWeight = 45m, suggestedWeightUnit = 2, restSeconds = 120 },
                    }
                    : null,
            }).ToArray()
        }).ToArray();
        Assert.Equal(HttpStatusCode.NoContent, (await t.PutAsync($"{Trainer}/routines/{routineId}/draft",
            new { draftVersionId = draftId, title, goal = "Fuerza e hipertrofia", durationWeeks = 6, days = dayList })).StatusCode);
        var versionId = await IdOf(await t.PostAsync($"{Trainer}/routines/{routineId}/publish", new { draftVersionId = draftId }), HttpStatusCode.OK);
        return (routineId, versionId, title);
    }

    private static async Task<int> AssignAsync(ApiSession t, int clientId, int versionId, DateOnly start)
    {
        var res = await t.PostAsync($"{Trainer}/assignments", new { clientIds = new[] { clientId }, routineVersionId = versionId, startDate = start, notes = "Registra el peso real" });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<AssignmentCreatedResponse>())!.Ids[0];
    }

    private static async Task<byte[]> PdfOf(HttpResponseMessage res)
    {
        Assert.True(res.StatusCode == HttpStatusCode.OK, $"{res.StatusCode}: {await res.Content.ReadAsStringAsync()}");
        Assert.Equal("application/pdf", res.Content.Headers.ContentType!.MediaType);
        var bytes = await res.Content.ReadAsByteArrayAsync();
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        return bytes;
    }

    private static int Pages(byte[] pdf)
    {
        using var ms = new MemoryStream(pdf);
        return PdfReader.Open(ms, PdfDocumentOpenMode.Import).PageCount;
    }

    private static async Task<XLWorkbook> XlsxOf(HttpResponseMessage res)
    {
        Assert.True(res.StatusCode == HttpStatusCode.OK, $"{res.StatusCode}: {await res.Content.ReadAsStringAsync()}");
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", res.Content.Headers.ContentType!.MediaType);
        return new XLWorkbook(new MemoryStream(await res.Content.ReadAsByteArrayAsync()));
    }

    [Fact]
    public async Task Routine_pdf_is_generated_with_pagination_and_only_for_authorized_users()
    {
        using var t = await TrainerAsync();
        var (clientA, idA) = await ClientAsync(t, "Begoña");
        var (clientB, _) = await ClientAsync(t, "Inés");
        var (routineId, versionId, _) = await RoutineAsync(t, days: 6);

        // Versión sin cliente (entrenadora): varias páginas por tener 6 días × 8 ejercicios.
        var res = await t.GetAsync($"{Trainer}/routines/{routineId}/versions/{versionId}/pdf");
        var pdf = await PdfOf(res);
        Assert.True(Pages(pdf) >= 2, "Una rutina larga debe paginarse.");
        Assert.EndsWith(".pdf", res.Content.Headers.ContentDisposition!.FileName!.Trim('"'));
        Assert.DoesNotContain(" ", res.Content.Headers.ContentDisposition.FileName!.Trim('"'));

        // Rutina asignada: la entrenadora y el propio cliente pueden descargarla.
        var assignment = await AssignAsync(t, idA, versionId, Today);
        Assert.True(Pages(await PdfOf(await t.GetAsync($"{Trainer}/assignments/{assignment}/pdf"))) >= 2);
        await PdfOf(await clientA.GetAsync($"{Portal}/program/{assignment}/pdf"));

        // Nadie más: otro cliente, otra entrenadora, ni el cliente por la ruta de la entrenadora, ni sin sesión.
        Assert.Equal(HttpStatusCode.NotFound, (await clientB.GetAsync($"{Portal}/program/{assignment}/pdf")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await clientA.GetAsync($"{Trainer}/assignments/{assignment}/pdf")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await t.GetAsync($"{Portal}/program/{assignment}/pdf")).StatusCode);
        using (var other = await TrainerAsync())
        {
            Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Trainer}/assignments/{assignment}/pdf")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"{Trainer}/routines/{routineId}/versions/{versionId}/pdf")).StatusCode);
        }
        using (var anon = api.NewSession())
            Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync($"{Portal}/program/{assignment}/pdf")).StatusCode);

        // Una asignación cancelada ya no es un documento autorizado para el cliente (la entrenadora conserva el acceso).
        var scheduled = await AssignAsync(t, idA, versionId, Today.AddDays(10));
        await PdfOf(await clientA.GetAsync($"{Portal}/program/{scheduled}/pdf"));
        Assert.Equal(HttpStatusCode.NoContent, (await t.PostAsync($"{Trainer}/assignments/{scheduled}/cancel")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await clientA.GetAsync($"{Portal}/program/{scheduled}/pdf")).StatusCode);
        await PdfOf(await t.GetAsync($"{Trainer}/assignments/{scheduled}/pdf"));

        await using var db = api.NewDbContext();
        Assert.True(await db.AuditLogs.CountAsync(a => a.Action == "AssignmentPdfExported" && a.EntityId == assignment.ToString()) >= 2);
    }

    [Fact]
    public async Task Excel_exports_contain_real_data_respect_ownership_and_never_create_formulas()
    {
        using var t = await TrainerAsync();
        var (_, idA) = await ClientAsync(t, "Begoña");
        var (_, versionId, title) = await RoutineAsync(t, days: 1);
        await AssignAsync(t, idA, versionId, Today);
        Assert.Equal(HttpStatusCode.Created, (await t.PostAsync($"{Trainer}/clients/{idA}/notes", new { content = "Nota privada que no se exporta" })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await t.PostAsync($"{Trainer}/clients/{idA}/evaluations", new
        {
            evaluatedOn = Today.AddDays(-7), notes = "=HYPERLINK(\"http://malo\")",
            measurements = new object[] { new { measurementTypeId = 1, value = 64.25m }, new { measurementTypeId = 2, value = 72m, notes = "Sobre el ombligo" } }
        })).StatusCode);

        using var other = await TrainerAsync();
        var (_, foreignId) = await ClientAsync(other, "Ajena");
        await RoutineAsync(other, days: 1);

        // Clientes: perfil y asignaciones, sin notas privadas ni clientes ajenos.
        using (var wb = await XlsxOf(await t.GetAsync($"{Trainer}/exports/clients")))
        {
            var sheet = wb.Worksheet("Clientes");
            Assert.Equal("Nombre", sheet.Cell(1, 1).GetString());
            var names = sheet.Column(1).CellsUsed().Skip(1).Select(c => c.GetString()).ToList();
            Assert.Equal(["Begoña"], names);
            Assert.Equal(title, sheet.Cell(2, 18).GetString()); // programa vigente
            Assert.DoesNotContain(wb.Worksheets.SelectMany(w => w.CellsUsed()), c => c.GetString().Contains("Nota privada"));
            Assert.Equal("Vigente", wb.Worksheet("Asignaciones").Cell(2, 6).GetString());
            Assert.Equal(Today.ToDateTime(TimeOnly.MinValue), wb.Worksheet("Asignaciones").Cell(2, 4).GetDateTime());
        }

        // Rutinas: resumen y detalle de la versión publicada, solo las propias.
        using (var wb = await XlsxOf(await t.GetAsync($"{Trainer}/exports/routines")))
        {
            var summary = wb.Worksheet("Rutinas");
            Assert.Equal([title], summary.Column(1).CellsUsed().Skip(1).Select(c => c.GetString()).ToList());
            Assert.Equal(1, summary.Cell(2, 4).GetValue<int>()); // versión publicada
            Assert.Equal(1, summary.Cell(2, 9).GetValue<int>()); // un cliente con la rutina vigente
            var detail = wb.Worksheet("Detalle");
            Assert.Equal(9, detail.LastRowUsed()!.RowNumber()); // encabezado + 8 ejercicios
            Assert.Equal("8–12", detail.Cell(2, 9).GetString());
            Assert.Equal(42.5m, detail.Cell(2, 10).GetValue<decimal>());
            Assert.Contains("S2 Efectiva · 8 reps · 45 lb · 2 min", detail.Cell(4, 17).GetString());
        }

        // Evaluaciones: una fila por medida, con valor numérico y unidad; el texto peligroso queda como texto.
        using (var wb = await XlsxOf(await t.GetAsync($"{Trainer}/exports/evaluations?clientId={idA}")))
        {
            var sheet = wb.Worksheet("Evaluaciones");
            Assert.Equal(3, sheet.LastRowUsed()!.RowNumber());
            Assert.Equal(("Peso corporal", 64.25m, "kg"), (sheet.Cell(2, 3).GetString(), sheet.Cell(2, 4).GetValue<decimal>(), sheet.Cell(2, 5).GetString()));
            Assert.Equal(Today.AddDays(-7).ToDateTime(TimeOnly.MinValue), sheet.Cell(2, 2).GetDateTime());
            Assert.False(sheet.Cell(2, 7).HasFormula);
            Assert.Equal("=HYPERLINK(\"http://malo\")", sheet.Cell(2, 7).GetString());
        }
        Assert.Equal(HttpStatusCode.NotFound, (await t.GetAsync($"{Trainer}/exports/evaluations?clientId={foreignId}")).StatusCode);
        using (var wb = await XlsxOf(await other.GetAsync($"{Trainer}/exports/evaluations")))
            Assert.Equal(1, wb.Worksheet("Evaluaciones").LastRowUsed()!.RowNumber()); // la otra entrenadora no ve evaluaciones ajenas

        await using var db = api.NewDbContext();
        Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == "ClientsExported"));
        Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == "EvaluationsExported" && a.Details == $"Cliente {idA}"));
    }

    [Fact]
    public async Task Clients_cannot_use_trainer_exports()
    {
        using var t = await TrainerAsync();
        var (client, _) = await ClientAsync(t, "Begoña");
        foreach (var path in new[] { "exports/clients", "exports/routines", "exports/evaluations" })
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"{Trainer}/{path}")).StatusCode);
    }
}
