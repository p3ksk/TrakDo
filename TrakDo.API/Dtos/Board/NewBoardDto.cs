using System.ComponentModel.DataAnnotations;

namespace TrakDo.API.Dtos.Board;

public class NewBoardDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; }

    [StringLength(2000)]
    public string? Description { get; set; }

    public int SortOrder { get; set; }
    public string? Color { get; set; }
}