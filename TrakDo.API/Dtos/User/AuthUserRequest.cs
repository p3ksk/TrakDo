using System.ComponentModel.DataAnnotations;

namespace TrakDo.API.Dtos.User;

public class AuthUserRequest
{
    [Required]
    [MinLength(3)]
    [MaxLength(32)]
    public string Username { get; set; }

    [Required]
    [MinLength(6)]
    public string Password { get; set; }
}