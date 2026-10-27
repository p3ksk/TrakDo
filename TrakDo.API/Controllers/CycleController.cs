using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Dtos.Cycle;
using TrakDo.API.Helpers;
using TrakDo.API.Models;

namespace TrakDo.API.Controllers;

public class CycleController : V1BaseController
{
    private readonly ILogger<CycleController> _logger;
    private readonly IDbContextFactory<TrakDoDbContext> _contextFactory;

    public CycleController(ILogger<CycleController> logger, IDbContextFactory<TrakDoDbContext> contextFactory)
    {
        _logger = logger;
        _contextFactory = contextFactory;
    }

    /// <summary>All cycles of a board, newest first, with completion and tracked-time totals.</summary>
    [HttpGet("board/{boardId}")]
    public async Task<IActionResult> GetCyclesAsync([FromRoute] long boardId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var board = await context.Boards.SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == boardId);
        if (board == null)
        {
            _logger.LogWarning("User {currentUserId} looking for cycles of non existent board {boardId}", CurrentUserId, boardId);
            return BadRequest();
        }

        var cycles = await context.Cycles
            .Where(_ => _.BoardId == boardId)
            .OrderByDescending(_ => _.Number)
            .ToListAsync();
        var completedCounts = await context.Tasks
            .Where(_ => _.BoardId == boardId && _.CycleId != null)
            .GroupBy(_ => _.CycleId!.Value)
            .Select(group => new { CycleId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(_ => _.CycleId, _ => _.Count);
        var sessions = await context.Sessions
            .Where(_ => _.Task.BoardId == boardId && _.Duration != null)
            .Select(_ => new { _.StartTime, _.Duration })
            .ToListAsync();

        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var cycleDtos = cycles.Select(cycle => new CycleDto
        {
            Id = cycle.Id,
            BoardId = cycle.BoardId,
            Number = cycle.Number,
            Goal = cycle.Goal,
            StartDate = UserDateTimeHelper.ConvertUtcToUserLocal(cycle.StartDate, timezone),
            EndDate = UserDateTimeHelper.ConvertUtcToUserLocal(cycle.EndDate, timezone),
            ClosedAt = UserDateTimeHelper.ConvertUtcToUserLocal(cycle.ClosedAt, timezone),
            IsActive = cycle.ClosedAt == null,
            CompletedCount = completedCounts.GetValueOrDefault(cycle.Id),
            CarriedOverCount = cycle.CarriedOverCount,
            TrackedSeconds = sessions
                .Where(_ => _.StartTime >= cycle.StartDate && _.StartTime < cycle.EndDate)
                .Sum(_ => (long)_.Duration!.Value)
        }).ToArray();
        return Ok(cycleDtos);
    }

    /// <summary>Turns cycles on or off for a board and sets their length.</summary>
    [HttpPut("board/{boardId}/settings")]
    public async Task<IActionResult> UpdateCycleSettingsAsync([FromRoute] long boardId, [FromBody] UpdateCycleSettingsRequest request)
    {
        if (!BoardLifecycleHelper.SupportedCycleLengths.Contains(request.LengthDays))
        {
            return BadRequest("Unsupported cycle length.");
        }

        await using var context = await _contextFactory.CreateDbContextAsync();
        var board = await context.Boards.SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == boardId);
        if (board == null)
        {
            _logger.LogWarning("User {currentUserId} tries to change cycle settings of non existent board {boardId}", CurrentUserId, boardId);
            return BadRequest();
        }

        board.CycleLengthDays = request.LengthDays;
        var activeCycle = await BoardLifecycleHelper.GetActiveCycleAsync(context, boardId);
        if (request.Enabled)
        {
            if (activeCycle == null)
            {
                var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
                await BoardLifecycleHelper.StartFirstCycleAsync(context, board, timezone);
            }
            else
            {
                activeCycle.EndDate = activeCycle.StartDate.AddDays(request.LengthDays);
            }
        }
        else if (board.CyclesEnabled && activeCycle != null)
        {
            await EndCycleWithoutArchivingAsync(context, activeCycle);
        }

        board.CyclesEnabled = request.Enabled;
        board.Updated = DateTime.UtcNow;
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{cycleId}")]
    public async Task<IActionResult> UpdateCycleAsync([FromRoute] long cycleId, [FromBody] UpdateCycleRequest request)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var cycle = await context.Cycles.SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == cycleId);
        if (cycle == null)
        {
            _logger.LogWarning("User {currentUserId} tries to update non existent cycle {cycleId}", CurrentUserId, cycleId);
            return BadRequest();
        }

        cycle.Goal = string.IsNullOrWhiteSpace(request.Goal) ? null : request.Goal.Trim();
        await context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Closes the active cycle now: archives its done tasks and starts the next cycle.</summary>
    [HttpPost("{cycleId}/close")]
    public async Task<IActionResult> CloseCycleAsync([FromRoute] long cycleId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var cycle = await context.Cycles
            .Include(_ => _.Board)
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == cycleId);
        if (cycle == null || cycle.ClosedAt != null || !cycle.Board.CyclesEnabled)
        {
            _logger.LogWarning("User {currentUserId} tries to close cycle {cycleId} that is not active", CurrentUserId, cycleId);
            return BadRequest();
        }

        await BoardLifecycleHelper.CloseCycleAsync(context, cycle.Board, cycle, DateTime.UtcNow, keepSchedule: false);
        await context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Used when cycles are switched off: drops an unused cycle, otherwise ends it as of now
    /// without archiving anything so its completed tasks keep their history.
    /// </summary>
    private static async System.Threading.Tasks.Task EndCycleWithoutArchivingAsync(TrakDoDbContext context, Cycle cycle)
    {
        var hasTasks = await context.Tasks.AnyAsync(_ => _.CycleId == cycle.Id);
        if (!hasTasks)
        {
            context.Cycles.Remove(cycle);
            return;
        }

        var utcNow = DateTime.UtcNow;
        cycle.ClosedAt = utcNow;
        cycle.EndDate = utcNow < cycle.EndDate ? utcNow : cycle.EndDate;
        cycle.CarriedOverCount = await context.Tasks.CountAsync(_ => _.BoardId == cycle.BoardId && _.ArchivedAt == null && !_.Column.IsDoneColumn);
    }
}
