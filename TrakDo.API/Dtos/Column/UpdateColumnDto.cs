using System.ComponentModel.DataAnnotations;

namespace TrakDo.API.Dtos.Column;

public class UpdateColumnDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; }

    public int SortOrder { get; set; }

    /// <summary>Marks this column as the board's done column. Null leaves it unchanged.</summary>
    public bool? IsDoneColumn { get; set; }
}
