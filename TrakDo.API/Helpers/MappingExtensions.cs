using TrakDo.API.Dtos.Board;
using TrakDo.API.Dtos.Column;
using TrakDo.API.Dtos.Session;
using TrakDo.API.Dtos.Task;
using TrakDo.API.Models;
using Task = TrakDo.API.Models.Task;

namespace TrakDo.API.Helpers;

public static class MappingExtensions
{
    public static Board ToBoard(this NewBoardDto source)
    {
        return new Board
        {
            Name = source.Name,
            Description = source.Description,
            SortOrder = source.SortOrder,
            Color = source.Color
        };
    }

    public static BoardDto ToBoardDto(this Board source)
    {
        return new BoardDto
        {
            Id = source.Id,
            UserId = source.UserId,
            Name = source.Name,
            Description = source.Description,
            Color = source.Color,
            SortOrder = source.SortOrder,
            Created = source.Created,
            Updated = source.Updated,
            Columns = source.Columns?.Select(column => column.ToColumnDto()).ToArray() ?? []
        };
    }

    public static Column ToColumn(this NewColumnDto source)
    {
        return new Column
        {
            Name = source.Name,
            SortOrder = source.SortOrder
        };
    }

    public static ColumnDto ToColumnDto(this Column source)
    {
        return new ColumnDto
        {
            Id = source.Id,
            BoardId = source.BoardId,
            Name = source.Name,
            SortOrder = source.SortOrder,
            Created = source.Created,
            Updated = source.Updated,
            Tasks = source.Tasks?.Select(task => task.ToTaskDto()).ToArray() ?? []
        };
    }

    public static Task ToTask(this NewTaskDto source)
    {
        return new Task
        {
            ColumnId = source.ColumnId,
            BoardId = source.BoardId,
            Title = source.Title,
            Description = source.Description,
            Color = source.Color,
            EstimatedMinutes = source.EstimatedMinutes,
            SortOrder = source.SortOrder,
            TaskPriority = source.TaskPriority,
            DueDate = source.DueDate
        };
    }

    public static TaskDto ToTaskDto(this Task source)
    {
        return new TaskDto
        {
            Id = source.Id,
            ColumnId = source.ColumnId,
            BoardId = source.BoardId,
            Title = source.Title,
            Description = source.Description,
            Color = source.Color,
            EstimatedMinutes = source.EstimatedMinutes,
            SortOrder = source.SortOrder,
            TaskPriority = source.TaskPriority,
            DueDate = source.DueDate,
            Created = source.Created,
            Updated = source.Updated,
            Sessions = source.Sessions?.Select(session => session.ToSessionDto()).ToArray() ?? []
        };
    }

    public static SessionDto ToSessionDto(this Session source)
    {
        return new SessionDto
        {
            Id = source.Id,
            TaskId = source.TaskId,
            BoardId = source.Task?.BoardId ?? 0,
            TaskTitle = source.Task?.Title ?? string.Empty,
            Color = source.Task?.Color,
            StartTime = source.StartTime,
            EndTime = source.EndTime,
            Duration = source.Duration,
            Notes = source.Notes ?? string.Empty
        };
    }
}
