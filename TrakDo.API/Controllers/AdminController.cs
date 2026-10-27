using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Dtos.Admin;
using TrakDo.API.Helpers;

namespace TrakDo.API.Controllers;

[Authorize(Policy = AdminRequirement.PolicyName)]
public class AdminController : V1BaseController
{
    private const int RegistrationTrendDays = 30;
    private readonly ILogger<AdminController> _logger;
    private readonly IDbContextFactory<TrakDoDbContext> _contextFactory;

    public AdminController(ILogger<AdminController> logger, IDbContextFactory<TrakDoDbContext> contextFactory)
    {
        _logger = logger;
        _contextFactory = contextFactory;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStatsAsync()
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var nowUtc = DateTime.UtcNow;
        var weekAgo = nowUtc.AddDays(-7);
        var monthAgo = nowUtc.AddDays(-30);

        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var todayLocal = UserDateTimeHelper.ConvertUtcToUserLocal(nowUtc, timezone).Date;
        var firstDayLocal = todayLocal.AddDays(-(RegistrationTrendDays - 1));
        var firstDayUtc = UserDateTimeHelper.ConvertUserLocalToUtc(firstDayLocal, timezone);
        var registrationsByDay = (await context.Users
                .Where(_ => _.Created >= firstDayUtc)
                .Select(_ => _.Created)
                .ToListAsync())
            .GroupBy(created => UserDateTimeHelper.ConvertUtcToUserLocal(created, timezone).Date)
            .ToDictionary(group => group.Key, group => group.Count());

        var stats = new AdminStatsDto
        {
            Users = await context.Users.CountAsync(),
            Admins = await context.Users.CountAsync(_ => _.IsAdmin),
            Boards = await context.Boards.CountAsync(),
            Tasks = await context.Tasks.CountAsync(),
            Sessions = await context.Sessions.CountAsync(),
            TrackedSeconds = await context.Sessions.SumAsync(_ => (long?)_.Duration) ?? 0,
            RunningTimers = await context.Sessions.CountAsync(_ => _.EndTime == null),
            LoggedInLast7Days = await context.Users.CountAsync(_ => _.LastLogin >= weekAgo),
            LoggedInLast30Days = await context.Users.CountAsync(_ => _.LastLogin >= monthAgo),
            TrackingLast7Days = await CountTrackingUsersAsync(context, weekAgo),
            TrackingLast30Days = await CountTrackingUsersAsync(context, monthAgo),
            RegistrationsPerDay = Enumerable.Range(0, RegistrationTrendDays)
                .Select(offset => firstDayLocal.AddDays(offset))
                .Select(day => new DailyCountDto
                {
                    Date = day.ToString("yyyy-MM-dd"),
                    Count = registrationsByDay.GetValueOrDefault(day)
                })
                .ToList()
        };

        return Ok(stats);
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsersAsync()
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var users = await context.Users.OrderBy(_ => _.Created).ToListAsync();
        return Ok(users.Select(user => ToDto(user, timezone)));
    }

    [HttpPut("users/{id}/admin")]
    public async Task<IActionResult> UpdateAdminRoleAsync([FromRoute] long id, [FromBody] UpdateAdminRoleRequest request)
    {
        if (id == CurrentUserId)
        {
            return BadRequest("You can't change your own admin rights.");
        }

        await using var context = await _contextFactory.CreateDbContextAsync();
        var user = await context.Users.SingleOrDefaultAsync(_ => _.Id == id);
        if (user == null)
        {
            return NotFound("User not found.");
        }

        user.IsAdmin = request.IsAdmin;
        await context.SaveChangesAsync();
        _logger.LogInformation("Admin {currentUserId} set IsAdmin={isAdmin} for user {userId}", CurrentUserId, request.IsAdmin, id);

        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        return Ok(ToDto(user, timezone));
    }

    [HttpPut("users/{id}/password")]
    public async Task<IActionResult> ResetPasswordAsync([FromRoute] long id, [FromBody] ResetPasswordRequest request)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var user = await context.Users.SingleOrDefaultAsync(_ => _.Id == id);
        if (user == null)
        {
            return NotFound("User not found.");
        }

        SecretHelper.CreatePasswordHash(request.Password, out byte[] passwordHash, out byte[] passwordSalt);
        user.PasswordHash = passwordHash;
        user.PasswordSalt = passwordSalt;
        await context.SaveChangesAsync();
        _logger.LogInformation("Admin {currentUserId} reset the password of user {userId}", CurrentUserId, id);

        return NoContent();
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUserAsync([FromRoute] long id)
    {
        if (id == CurrentUserId)
        {
            return BadRequest("You can't delete your own account.");
        }

        await using var context = await _contextFactory.CreateDbContextAsync();
        // Boards, columns, tasks and sessions go with it through the cascading foreign keys.
        var deleted = await context.Users.Where(_ => _.Id == id).ExecuteDeleteAsync();
        if (deleted == 0)
        {
            return NotFound("User not found.");
        }

        _logger.LogInformation("Admin {currentUserId} deleted user {userId}", CurrentUserId, id);
        return NoContent();
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettingsAsync()
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        return Ok(new AdminSettingsDto
        {
            RegistrationEnabled = await AppSettingsHelper.GetBoolAsync(context, AppSettingsHelper.RegistrationEnabledKey, true)
        });
    }

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettingsAsync([FromBody] AdminSettingsDto request)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        await AppSettingsHelper.SetBoolAsync(context, AppSettingsHelper.RegistrationEnabledKey, request.RegistrationEnabled);
        _logger.LogInformation("Admin {currentUserId} set RegistrationEnabled={enabled}", CurrentUserId, request.RegistrationEnabled);
        return Ok(request);
    }

    private static Task<int> CountTrackingUsersAsync(TrakDoDbContext context, DateTime sinceUtc)
    {
        return context.Sessions
            .Where(_ => _.StartTime >= sinceUtc)
            .Select(_ => _.Task.Board.UserId)
            .Distinct()
            .CountAsync();
    }

    private static AdminUserDto ToDto(Models.User user, string timezone)
    {
        return new AdminUserDto
        {
            Id = user.Id,
            Username = user.Username,
            IsAdmin = user.IsAdmin,
            Created = UserDateTimeHelper.ConvertUtcToUserLocal(user.Created, timezone),
            LastLogin = UserDateTimeHelper.ConvertUtcToUserLocal(user.LastLogin, timezone)
        };
    }
}
