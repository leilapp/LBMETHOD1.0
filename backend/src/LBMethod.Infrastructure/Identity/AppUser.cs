using Microsoft.AspNetCore.Identity;

namespace LBMethod.Infrastructure.Identity;

/// <summary>Cuenta de acceso (ASP.NET Core Identity). La contraseña se guarda solo como hash.</summary>
public class AppUser : IdentityUser<int>
{
    public string DisplayName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class AppRole : IdentityRole<int>
{
    public AppRole() { }
    public AppRole(string name) : base(name) { }
}

public static class Roles
{
    public const string Trainer = "TRAINER";
    public const string Client = "CLIENT";
}
