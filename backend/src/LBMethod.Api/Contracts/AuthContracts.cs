using System.ComponentModel.DataAnnotations;

namespace LBMethod.Api.Contracts;

public record LoginRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(128)] string Password);

public record ChangePasswordRequest(
    [Required, MaxLength(128)] string CurrentPassword,
    [Required, MinLength(10), MaxLength(128)] string NewPassword);

public record CsrfTokenResponse(string Token);

public record SessionResponse(int UserId, string DisplayName, string Email, string Role, bool MustChangePassword, int? ClientId);

public record CreateClientAccountRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Phone, MaxLength(30)] string? Phone);

public record SetAccessRequest([Required] bool? Enabled);

public record TemporaryPasswordResponse(int ClientId, string TemporaryPassword);

public record ClientSummaryResponse(int Id, string FirstName, string LastName, string Email, string Status, bool HasAccount);

/// <summary>Perfil visible para el propio cliente. No incluye observaciones privadas de la entrenadora.</summary>
public record ClientProfileResponse(int Id, string FirstName, string LastName, string Email, string? Phone, DateOnly? BirthDate, string? Goal, string? DeclaredLimitations);
