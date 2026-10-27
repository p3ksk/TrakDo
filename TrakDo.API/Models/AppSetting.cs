namespace TrakDo.API.Models;

/// <summary>Application-wide key/value setting managed by admins.</summary>
public class AppSetting
{
    public string Key { get; set; }

    public string Value { get; set; }
}
