using TrakDo.API.Dtos.Session;
using TrakDo.API.Enums;

namespace TrakDo.API.Dtos.Task;

public class TaskDto
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
    public SessionDto[] Sessions { get; set; }
}