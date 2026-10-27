namespace TrakDo.API.Models;

public class Column
{
    public long Id { get; set; }
    public long BoardId { get; set; }
    public string Name { get; set; }
    public int SortOrder { get; set; }
    /// <summary>Tasks in this column count as completed. At most one per board.</summary>
    public bool IsDoneColumn { get; set; }
    public DateTime Created { get; set; }
    public DateTime? Updated { get; set; }
    
    public Board Board { get; set; }
    public ICollection<Task> Tasks { get; set; }
}