using System.ComponentModel.DataAnnotations;

namespace TrakDo.API.Dtos.Admin;

public class UpdateAdminRoleRequest
{
    public bool IsAdmin { get; set; }
}

public class ResetPasswordRequest
{
    [Required]
    [MinLength(6)]
    public string Password { get; set; }
}

public class AdminSettingsDto
{
    public bool RegistrationEnabled { get; set; }
}
