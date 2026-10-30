using LBMethod.Application.Library;
using Microsoft.AspNetCore.Mvc;

namespace LBMethod.Api.Controllers.Trainer.Library;

internal static class LibraryResultExtensions
{
    /// <summary>Traduce el resultado de la biblioteca a la respuesta HTTP correspondiente.</summary>
    public static IActionResult ToResponse(this ControllerBase controller, LibraryResult result, Func<IActionResult> onSuccess) => result.Error switch
    {
        LibraryError.None => onSuccess(),
        LibraryError.NotFound => controller.NotFound(),
        LibraryError.Duplicate => controller.Conflict(new ValidationProblemDetails(Errors(result))
            { Status = 409, Title = "Registro duplicado", Detail = Errors(result).Values.SelectMany(v => v).FirstOrDefault() }),
        _ => controller.ValidationProblem(new ValidationProblemDetails(Errors(result)))
    };

    private static Dictionary<string, string[]> Errors(LibraryResult result) =>
        result.Errors?.ToDictionary(e => e.Key, e => e.Value) ?? new Dictionary<string, string[]>();
}
