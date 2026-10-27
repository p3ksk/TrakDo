namespace TrakDo.API.Dtos.Admin;

public class AdminStatsDto
{
    public int Users { get; set; }
    public int Admins { get; set; }
    public int Boards { get; set; }
    public int Tasks { get; set; }
    public int Sessions { get; set; }
    public long TrackedSeconds { get; set; }
    public int RunningTimers { get; set; }

    public int LoggedInLast7Days { get; set; }
    public int LoggedInLast30Days { get; set; }
    public int TrackingLast7Days { get; set; }
    public int TrackingLast30Days { get; set; }

    /// <summary>New registrations per day in the admin's timezone, oldest first.</summary>
    public List<DailyCountDto> RegistrationsPerDay { get; set; } = [];
}

public class DailyCountDto
{
    /// <summary>Calendar day formatted as yyyy-MM-dd.</summary>
    public string Date { get; set; }
    public int Count { get; set; }
}
