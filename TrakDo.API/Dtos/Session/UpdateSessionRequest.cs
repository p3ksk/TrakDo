using System.ComponentModel.DataAnnotations;

namespace TrakDo.API.Dtos.Session;

public class UpdateSessionRequest
{
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    [StringLength(5000)]
    public string Notes { get; set; } = string.Empty;
}
