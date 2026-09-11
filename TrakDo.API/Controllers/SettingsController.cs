using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Dtos.Settings;

namespace TrakDo.API.Controllers;

public class SettingsController : V1BaseController
{
    private static readonly HashSet<string> SupportedDateFormats = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"];
    private readonly ILogger<SettingsController> _logger;
    private readonly IDbContextFactory<TrakDoDbContext> _contextFactory;

    public SettingsController(ILogger<SettingsController> logger, IDbContextFactory<TrakDoDbContext> contextFactory)
    {
        _logger = logger;
        _contextFactory = contextFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetUserSettingsAsync()
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var user = await context.Users.SingleOrDefaultAsync(_ => _.Id == CurrentUserId);
        if (user == null)
        {
            _logger.LogWarning("User {currentUserId} was not found while reading settings", CurrentUserId);
            return NotFound();
        }

        return Ok(ToDto(user));
    }

    [HttpPut]
    public async Task<IActionResult> UpdateUserSettingsAsync([FromBody] UpdateUserSettingsRequest request)
    {
        if (!SupportedDateFormats.Contains(request.DateFormat))
        {
            return BadRequest("Unsupported date format.");
        }

        if (!IsValidTimezone(request.Timezone))
        {
            return BadRequest("Unsupported timezone.");
        }

        if (request.WorkDayStartHour < 0 || request.WorkDayStartHour > 23)
        {
            return BadRequest("Work day start hour must be between 0 and 23.");
        }

        if (request.WorkDayEndHour < 1 || request.WorkDayEndHour > 24)
        {
            return BadRequest("Work day end hour must be between 1 and 24.");
        }

        if (request.WorkDayStartHour >= request.WorkDayEndHour)
        {
            return BadRequest("Work day end hour must be greater than start hour.");
        }

        await using var context = await _contextFactory.CreateDbContextAsync();
        var user = await context.Users.SingleOrDefaultAsync(_ => _.Id == CurrentUserId);
        if (user == null)
        {
            _logger.LogWarning("User {currentUserId} was not found while updating settings", CurrentUserId);
            return NotFound();
        }

        user.Timezone = request.Timezone;
        user.DateFormat = request.DateFormat;
        user.Use24HourTime = request.Use24HourTime;
        user.WorkDayStartHour = request.WorkDayStartHour;
        user.WorkDayEndHour = request.WorkDayEndHour;

        await context.SaveChangesAsync();
        return Ok(ToDto(user));
    }

    private static bool IsValidTimezone(string timezone)
    {
        if (string.IsNullOrWhiteSpace(timezone))
        {
            return false;
        }

        try
        {
            TimeZoneInfo.FindSystemTimeZoneById(timezone);
            return true;
        }
        catch (TimeZoneNotFoundException)
        {
            return false;
        }
        catch (InvalidTimeZoneException)
        {
            return false;
        }
    }

    private static UserSettingsDto ToDto(Models.User user)
    {
        return new UserSettingsDto
        {
            Timezone = user.Timezone,
            DateFormat = user.DateFormat,
            Use24HourTime = user.Use24HourTime,
            WorkDayStartHour = user.WorkDayStartHour,
            WorkDayEndHour = user.WorkDayEndHour
        };
    }
}
