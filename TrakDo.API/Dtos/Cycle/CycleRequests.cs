using System.ComponentModel.DataAnnotations;

namespace TrakDo.API.Dtos.Cycle;

public class UpdateCycleSettingsRequest
{
    public bool Enabled { get; set; }
    public int LengthDays { get; set; } = 14;
}

public class UpdateCycleRequest
{
    [StringLength(500)]
    public string? Goal { get; set; }
}
