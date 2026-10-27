namespace TrakDo.API.Dtos.Admin;

public class AdminUserDto
{
    public long Id { get; set; }
    public string Username { get; set; }
    public bool IsAdmin { get; set; }
    public DateTime Created { get; set; }
    public DateTime? LastLogin { get; set; }
}
