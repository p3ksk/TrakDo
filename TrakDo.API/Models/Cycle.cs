namespace TrakDo.API.Models;

/// <summary>A fixed-length period of work on a board. Closing it archives the tasks completed during it.</summary>
public class Cycle
{
    public long Id { get; set; }
    public long BoardId { get; set; }
    public int Number { get; set; }
    public string? Goal { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime? ClosedAt { get; set; }
    /// <summary>Unfinished tasks left on the board when the cycle was closed.</summary>
    public int CarriedOverCount { get; set; }

    public Board Board { get; set; }
    public ICollection<Task> Tasks { get; set; }
}
