using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Models;
using Task = TrakDo.API.Models.Task;

namespace TrakDo.API.Helpers;

/// <summary>Completion, archiving and cycle rules shared by the board, task and cycle endpoints.</summary>
public static class BoardLifecycleHelper
{
    public static readonly int[] SupportedCycleLengths = [7, 14, 21, 28];

    /// <summary>Updates completion state of a task that was placed into <paramref name="column"/>.</summary>
    public static void ApplyColumnCompletion(Task task, Column column, Cycle? activeCycle, DateTime utcNow)
    {
        if (column.IsDoneColumn)
        {
            if (task.CompletedAt == null)
            {
                task.CompletedAt = utcNow;
                task.CycleId = activeCycle?.Id;
            }
            return;
        }

        task.CompletedAt = null;
        task.CycleId = null;
    }

    public static Task<Cycle?> GetActiveCycleAsync(TrakDoDbContext context, long boardId)
    {
        return context.Cycles
            .Where(_ => _.BoardId == boardId && _.ClosedAt == null)
            .OrderByDescending(_ => _.Number)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Lazy housekeeping run when a board is opened: archives done tasks older than the user's
    /// auto-archive period and rolls over a cycle whose end date has passed.
    /// </summary>
    public static async System.Threading.Tasks.Task RunMaintenanceAsync(TrakDoDbContext context, Board board, int autoArchiveDays)
    {
        var utcNow = DateTime.UtcNow;

        if (autoArchiveDays > 0)
        {
            var threshold = utcNow.AddDays(-autoArchiveDays);
            var staleTasks = await context.Tasks
                .Where(_ => _.BoardId == board.Id && _.ArchivedAt == null && _.Column.IsDoneColumn
                            && _.CompletedAt != null && _.CompletedAt <= threshold)
                .ToListAsync();
            foreach (var task in staleTasks)
            {
                task.ArchivedAt = utcNow;
            }
        }

        if (board.CyclesEnabled)
        {
            var activeCycle = await GetActiveCycleAsync(context, board.Id);
            if (activeCycle != null && activeCycle.EndDate <= utcNow)
            {
                await CloseCycleAsync(context, board, activeCycle, utcNow, keepSchedule: true);
            }
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Archives the done tasks into <paramref name="cycle"/>, closes it and opens the next one.
    /// With <paramref name="keepSchedule"/> the next cycle stays on the original cadence (used for
    /// automatic rollover); otherwise it starts now (used when the user closes a cycle early).
    /// </summary>
    public static async Task<Cycle> CloseCycleAsync(TrakDoDbContext context, Board board, Cycle cycle, DateTime utcNow, bool keepSchedule)
    {
        var boardTasks = await context.Tasks
            .Include(_ => _.Column)
            .Where(_ => _.BoardId == board.Id && _.ArchivedAt == null)
            .ToListAsync();

        foreach (var task in boardTasks.Where(_ => _.Column.IsDoneColumn))
        {
            task.ArchivedAt = utcNow;
            task.CompletedAt ??= utcNow;
            task.CycleId ??= cycle.Id;
        }

        cycle.CarriedOverCount = boardTasks.Count(_ => !_.Column.IsDoneColumn);
        cycle.ClosedAt = utcNow;
        if (!keepSchedule)
        {
            cycle.EndDate = utcNow;
        }

        var lengthDays = board.CycleLengthDays;
        var nextStart = cycle.EndDate;
        while (nextStart.AddDays(lengthDays) <= utcNow)
        {
            // Skip periods that passed while nobody opened the board.
            nextStart = nextStart.AddDays(lengthDays);
        }

        var nextCycle = new Cycle
        {
            BoardId = board.Id,
            Number = cycle.Number + 1,
            StartDate = nextStart,
            EndDate = nextStart.AddDays(lengthDays)
        };
        context.Cycles.Add(nextCycle);
        return nextCycle;
    }

    /// <summary>Opens the first cycle of a board, starting at the beginning of the user's current day.</summary>
    public static async Task<Cycle> StartFirstCycleAsync(TrakDoDbContext context, Board board, string timezone)
    {
        var lastNumber = await context.Cycles
            .Where(_ => _.BoardId == board.Id)
            .MaxAsync(_ => (int?)_.Number) ?? 0;
        var userToday = UserDateTimeHelper.ConvertUtcToUserLocal(DateTime.UtcNow, timezone).Date;
        var startUtc = UserDateTimeHelper.ConvertUserLocalToUtc(userToday, timezone);
        var cycle = new Cycle
        {
            BoardId = board.Id,
            Number = lastNumber + 1,
            StartDate = startUtc,
            EndDate = startUtc.AddDays(board.CycleLengthDays)
        };
        context.Cycles.Add(cycle);
        return cycle;
    }
}
