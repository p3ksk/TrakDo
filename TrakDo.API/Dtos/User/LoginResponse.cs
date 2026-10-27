namespace TrakDo.API.Dtos.User;

public class LoginResponse
{
    public string Username { get; set; }
    public string Token { get; set; }
    public bool IsAdmin { get; set; }
}