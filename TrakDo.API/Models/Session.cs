namespace TrakDo.API.Models;

public class Session
{
    public long Id { get; set; }
    public long TaskId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public int? Duration { get; set; }
    public string Notes { get; set; } = string.Empty;
    
    public Task Task { get; set; }
}
