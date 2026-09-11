using TrakDo.API.Dtos.Task;

namespace TrakDo.API.Dtos.Column;

public class ColumnDto
{
    public long Id { get; set; }
    public long BoardId { get; set; }
    public string Name { get; set; }
    public int SortOrder { get; set; }
    public DateTime Created { get; set; }
    public DateTime? Updated { get; set; }
    public TaskDto[] Tasks { get; set; }
}