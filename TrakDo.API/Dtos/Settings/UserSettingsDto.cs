namespace TrakDo.API.Dtos.Settings;

public class UserSettingsDto
{
    public string Timezone { get; set; } = "UTC";
    public string DateFormat { get; set; } = "YYYY-MM-DD";
    public bool Use24HourTime { get; set; }
    public int WorkDayStartHour { get; set; }
    public int WorkDayEndHour { get; set; }
}
