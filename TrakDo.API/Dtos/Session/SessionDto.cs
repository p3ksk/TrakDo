namespace TrakDo.API.Dtos.Session;

public class SessionDto
{
    public long Id { get; set; }
    public long TaskId { get; set; }
    public long BoardId { get; set; }
    public string TaskTitle { get; set; }
    public string? Color { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public double? Duration { get; set; }
    public string Notes { get; set; } = string.Empty;
}
