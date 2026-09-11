using System.ComponentModel.DataAnnotations;
using TrakDo.API.Enums;

namespace TrakDo.API.Dtos.Task;

public class UpdateTaskDto
{
    [Required]
    [StringLength(500)]
    public string Title { get; set; }

    [StringLength(5000)]
    public string? Description { get; set; }

    public string? Color { get; set; }
    public int? EstimatedMinutes { get; set; }
    public int SortOrder { get; set; }
    public TaskPriority? TaskPriority { get; set; }
    public DateTime? DueDate { get; set; }
}
