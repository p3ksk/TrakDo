using TrakDo.API.Enums;

namespace TrakDo.API.Models;

public class Task
{
    public long Id { get; set; }
    public long ColumnId { get; set; }
    public long BoardId { get; set; }
    public string Title { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public int? EstimatedMinutes { get; set; }
    public int SortOrder { get; set; }
    public TaskPriority? TaskPriority { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime Created { get; set; }
    public DateTime? Updated { get; set; }
    /// <summary>Set when the task enters the board's done column, cleared when it leaves.</summary>
    public DateTime? CompletedAt { get; set; }
    /// <summary>Archived tasks are hidden from the board but keep their sessions.</summary>
    public DateTime? ArchivedAt { get; set; }
    /// <summary>The cycle the task was completed in.</summary>
    public long? CycleId { get; set; }
    
    public Column Column { get; set; }
    public Board Board { get; set; }
    public Cycle? Cycle { get; set; }
    public ICollection<Session> Sessions { get; set; }
}