using System.ComponentModel.DataAnnotations;

namespace TrakDo.API.Dtos.Column;

public class UpdateColumnDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; }

    public int SortOrder { get; set; }
}
