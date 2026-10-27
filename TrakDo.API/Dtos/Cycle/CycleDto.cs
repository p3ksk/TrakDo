namespace TrakDo.API.Dtos.Cycle;

public class CycleDto
{
    public long Id { get; set; }
    public long BoardId { get; set; }
    public int Number { get; set; }
    public string? Goal { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime? ClosedAt { get; set; }
    public bool IsActive { get; set; }
    public int CompletedCount { get; set; }
    public int CarriedOverCount { get; set; }
    /// <summary>Seconds tracked on the board's tasks between the cycle's start and end.</summary>
    public long TrackedSeconds { get; set; }
}
