using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Dtos.Board;
using TrakDo.API.Dtos.Column;
using TrakDo.API.Dtos.Session;
using TrakDo.API.Dtos.Task;

namespace TrakDo.API.Helpers;

public static class UserDateTimeHelper
{
    public static async Task<string> GetUserTimezoneAsync(TrakDoDbContext context, long userId)
    {
        var timezone = await context.Users
            .Where(_ => _.Id == userId)
            .Select(_ => _.Timezone)
            .SingleOrDefaultAsync();
        return string.IsNullOrWhiteSpace(timezone) ? "UTC" : timezone;
    }

    public static DateTime ConvertUtcToUserLocal(DateTime utcDateTime, string timezone)
    {
        var timeZoneInfo = ResolveTimezone(timezone);
        var normalizedUtc = utcDateTime.Kind switch
        {
            DateTimeKind.Utc => utcDateTime,
            DateTimeKind.Local => utcDateTime.ToUniversalTime(),
            _ => DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc)
        };
        var localDateTime = TimeZoneInfo.ConvertTimeFromUtc(normalizedUtc, timeZoneInfo);
        return DateTime.SpecifyKind(localDateTime, DateTimeKind.Unspecified);
    }

    public static DateTime? ConvertUtcToUserLocal(DateTime? utcDateTime, string timezone)
    {
        return utcDateTime.HasValue ? ConvertUtcToUserLocal(utcDateTime.Value, timezone) : null;
    }

    public static DateTime ConvertUserLocalToUtc(DateTime userDateTime, string timezone)
    {
        if (userDateTime.Kind == DateTimeKind.Utc)
        {
            return userDateTime;
        }

        if (userDateTime.Kind == DateTimeKind.Local)
        {
            return userDateTime.ToUniversalTime();
        }

        var timeZoneInfo = ResolveTimezone(timezone);
        var unspecifiedDateTime = DateTime.SpecifyKind(userDateTime, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(unspecifiedDateTime, timeZoneInfo);
    }

    public static DateTime? ConvertUserLocalToUtc(DateTime? userDateTime, string timezone)
    {
        return userDateTime.HasValue ? ConvertUserLocalToUtc(userDateTime.Value, timezone) : null;
    }

    public static void ConvertSessionDtoToUserLocal(SessionDto session, string timezone)
    {
        session.StartTime = ConvertUtcToUserLocal(session.StartTime, timezone);
        session.EndTime = ConvertUtcToUserLocal(session.EndTime, timezone);
    }

    public static void ConvertTaskDtoToUserLocal(TaskDto task, string timezone)
    {
        task.DueDate = ConvertUtcToUserLocal(task.DueDate, timezone);
        task.Created = ConvertUtcToUserLocal(task.Created, timezone);
        task.Updated = ConvertUtcToUserLocal(task.Updated, timezone);
        if (task.Sessions == null)
        {
            return;
        }

        foreach (var session in task.Sessions)
        {
            ConvertSessionDtoToUserLocal(session, timezone);
        }
    }

    public static void ConvertColumnDtoToUserLocal(ColumnDto column, string timezone)
    {
        column.Created = ConvertUtcToUserLocal(column.Created, timezone);
        column.Updated = ConvertUtcToUserLocal(column.Updated, timezone);
        if (column.Tasks == null)
        {
            return;
        }

        foreach (var task in column.Tasks)
        {
            ConvertTaskDtoToUserLocal(task, timezone);
        }
    }

    public static void ConvertBoardDtoToUserLocal(BoardDto board, string timezone)
    {
        board.Created = ConvertUtcToUserLocal(board.Created, timezone);
        board.Updated = ConvertUtcToUserLocal(board.Updated, timezone);
        if (board.Columns == null)
        {
            return;
        }

        foreach (var column in board.Columns)
        {
            ConvertColumnDtoToUserLocal(column, timezone);
        }
    }

    public static void ConvertTaskToUserLocal(TrakDo.API.Models.Task task, string timezone)
    {
        task.DueDate = ConvertUtcToUserLocal(task.DueDate, timezone);
        task.Created = ConvertUtcToUserLocal(task.Created, timezone);
        task.Updated = ConvertUtcToUserLocal(task.Updated, timezone);
        if (task.Sessions == null)
        {
            return;
        }

        foreach (var session in task.Sessions)
        {
            ConvertSessionToUserLocal(session, timezone);
        }
    }

    public static void ConvertSessionToUserLocal(TrakDo.API.Models.Session session, string timezone)
    {
        session.StartTime = ConvertUtcToUserLocal(session.StartTime, timezone);
        session.EndTime = ConvertUtcToUserLocal(session.EndTime, timezone);
    }

    public static void ConvertBoardToUserLocal(TrakDo.API.Models.Board board, string timezone)
    {
        board.Created = ConvertUtcToUserLocal(board.Created, timezone);
        board.Updated = ConvertUtcToUserLocal(board.Updated, timezone);
    }

    private static TimeZoneInfo ResolveTimezone(string timezone)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timezone);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }
}
