using TrakDo.API.Dtos.Column;

namespace TrakDo.API.Dtos.Board;

public class BoardDto
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public DateTime Created { get; set; }
    public DateTime? Updated { get; set; }
    public ColumnDto[] Columns { get; set; }
}