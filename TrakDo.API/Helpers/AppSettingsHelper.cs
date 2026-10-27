using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;

namespace TrakDo.API.Helpers;

public static class AppSettingsHelper
{
    public const string RegistrationEnabledKey = "RegistrationEnabled";

    public static async Task<bool> GetBoolAsync(TrakDoDbContext context, string key, bool defaultValue)
    {
        var value = await context.AppSettings.Where(_ => _.Key == key).Select(_ => _.Value).SingleOrDefaultAsync();
        return bool.TryParse(value, out var parsed) ? parsed : defaultValue;
    }

    public static async Task SetBoolAsync(TrakDoDbContext context, string key, bool value)
    {
        var setting = await context.AppSettings.SingleOrDefaultAsync(_ => _.Key == key);
        if (setting == null)
        {
            context.AppSettings.Add(new Models.AppSetting { Key = key, Value = value.ToString() });
        }
        else
        {
            setting.Value = value.ToString();
        }

        await context.SaveChangesAsync();
    }
}
