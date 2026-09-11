namespace TrakDo.API.Models;

public class Board
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public string? Color { get; set; }
    public int SortOrder { get; set; }
    public DateTime Created { get; set; }
    public DateTime? Updated { get; set; }
    
    public User User { get; set; }
    public ICollection<Column> Columns { get; set; }
}