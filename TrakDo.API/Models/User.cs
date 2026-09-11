using System.ComponentModel.DataAnnotations;

namespace TrakDo.API.Models;

public class User
{
    public long Id { get; set; }
   
    [MinLength(3)]
    [MaxLength(32)]
    public string Username { get; set; }
    
    public byte[] PasswordHash { get; set; }
    
    public byte[] PasswordSalt { get; set; }
    
    public DateTime Created { get; set; }

    public string Timezone { get; set; } = "UTC";

    public string DateFormat { get; set; } = "YYYY-MM-DD";

    public bool Use24HourTime { get; set; } = true;

    public int WorkDayStartHour { get; set; } = 9;

    public int WorkDayEndHour { get; set; } = 17;
    
    
    public ICollection<Board> Boards { get; set; }
}
