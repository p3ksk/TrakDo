using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Dtos.Task;
using TrakDo.API.Helpers;
using Task = TrakDo.API.Models.Task;

namespace TrakDo.API.Controllers;

public class TaskController: V1BaseController
{
    private readonly ILogger<TaskController> _logger;
    private readonly IDbContextFactory<TrakDoDbContext> _contextFactory;

    public TaskController(ILogger<TaskController> logger, IDbContextFactory<TrakDoDbContext> contextFactory)
    {
        _logger = logger;
        _contextFactory = contextFactory;
    }
    
    [HttpGet("board/{boardId}")]
    public async Task<IActionResult> GetTasksAsync([FromRoute] long boardId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var userTimezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var userTasks = await context.Tasks
            .Include(_ => _.Sessions)
            .Where(_ => _.Board.UserId == CurrentUserId && _.BoardId == boardId && _.ArchivedAt == null)
            .ToListAsync();
        foreach (var userTask in userTasks)
        {
            UserDateTimeHelper.ConvertTaskToUserLocal(userTask, userTimezone);
        }
        return Ok(userTasks);
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateTaskAsync([FromBody] NewTaskDto task)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var userBoard = await context.Boards.SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == task.BoardId);
        if (userBoard == null)
        {
            _logger.LogWarning("User {currentUserId} tries to add task to non existent board {boardId}", CurrentUserId, task.BoardId);
            return BadRequest();
        }
        
        var boardColumn = await context.Columns.Include(column => column.Tasks)
            .SingleOrDefaultAsync(_ => _.BoardId == task.BoardId && _.Id == task.ColumnId);
        if (boardColumn == null)
        {
            _logger.LogWarning("User {currentUserId} tries to add task to non existent column {columnId}", CurrentUserId, task.ColumnId);
            return BadRequest();
        }

        var userTimezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var newTask = task.ToTask();
        newTask.DueDate = UserDateTimeHelper.ConvertUserLocalToUtc(newTask.DueDate, userTimezone);
        newTask.Created = DateTime.UtcNow;
        var activeCycle = userBoard.CyclesEnabled ? await BoardLifecycleHelper.GetActiveCycleAsync(context, userBoard.Id) : null;
        BoardLifecycleHelper.ApplyColumnCompletion(newTask, boardColumn, activeCycle, newTask.Created);
        boardColumn.Tasks.Add(newTask);
        await context.SaveChangesAsync();
        return Ok(newTask.Id);
    }
    
    [HttpGet("{taskId}")]
    public async Task<IActionResult> GetTaskByIdAsync([FromRoute] long taskId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var task =  await context.Tasks
            .Include(t => t.Sessions)
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == taskId);
        if (task == null)
        {
            _logger.LogWarning("User {currentUserId} tries to get non existent task {taskId}", CurrentUserId, taskId);
            return BadRequest();
        }

        var userTimezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        UserDateTimeHelper.ConvertTaskToUserLocal(task, userTimezone);
        return Ok(task);
    }

    [HttpPut("{taskId}")]
    public async Task<IActionResult> UpdateTaskAsync([FromRoute] long taskId, [FromBody] UpdateTaskDto task)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var taskToUpdate = await context.Tasks
            .Include(t => t.Board)
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == taskId);
        if (taskToUpdate == null)
        {
            _logger.LogWarning("User {currentUserId} tries to update non existent task {taskId}", CurrentUserId, taskId);
            return BadRequest();
        }

        var userTimezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        taskToUpdate.Title = task.Title;
        taskToUpdate.Description = task.Description;
        taskToUpdate.Color = task.Color;
        taskToUpdate.EstimatedMinutes = task.EstimatedMinutes;
        taskToUpdate.SortOrder = task.SortOrder;
        taskToUpdate.TaskPriority = task.TaskPriority;
        taskToUpdate.DueDate = UserDateTimeHelper.ConvertUserLocalToUtc(task.DueDate, userTimezone);
        taskToUpdate.Updated = DateTime.UtcNow;

        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{taskId}")]
    public async Task<IActionResult> DeleteTaskAsync([FromRoute] long taskId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var taskToDelete = await context.Tasks
            .Include(t => t.Board)
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == taskId);
        if (taskToDelete == null)
        {
            _logger.LogWarning("User {currentUserId} tries to delete non existent task {taskId}", CurrentUserId, taskId);
            return BadRequest();
        }
        
        context.Tasks.Remove(taskToDelete);
        await context.SaveChangesAsync();
        return NoContent();
    }
    
    [HttpPatch("{taskId}/move/{newColumnId}")]
    public async Task<IActionResult> MoveTaskAsync([FromRoute] long taskId, [FromRoute] long newColumnId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var taskToMove = await context.Tasks
            .Include(t => t.Board)
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == taskId);
        if (taskToMove == null)
        {
            _logger.LogWarning("User {currentUserId} tries to move non existent task {taskId}", CurrentUserId, taskId);
            return BadRequest();
        }

        var targetColumn = await context.Columns.SingleOrDefaultAsync(_ => _.Id == newColumnId && _.BoardId == taskToMove.BoardId);
        if (targetColumn == null)
        {
            _logger.LogWarning("User {currentUserId} tries to move task {taskId} to column {columnId} outside its board", CurrentUserId, taskId, newColumnId);
            return BadRequest();
        }

        var activeCycle = taskToMove.Board.CyclesEnabled ? await BoardLifecycleHelper.GetActiveCycleAsync(context, taskToMove.BoardId) : null;
        taskToMove.ColumnId = newColumnId;
        BoardLifecycleHelper.ApplyColumnCompletion(taskToMove, targetColumn, activeCycle, DateTime.UtcNow);

        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("board/{boardId}/archived")]
    public async Task<IActionResult> GetArchivedTasksAsync([FromRoute] long boardId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var userTimezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var archivedTasks = await context.Tasks
            .Include(_ => _.Sessions)
            .Where(_ => _.Board.UserId == CurrentUserId && _.BoardId == boardId && _.ArchivedAt != null)
            .OrderByDescending(_ => _.CompletedAt ?? _.ArchivedAt)
            .ToListAsync();
        var taskDtos = archivedTasks.Select(task => task.ToTaskDto()).ToArray();
        foreach (var taskDto in taskDtos)
        {
            UserDateTimeHelper.ConvertTaskDtoToUserLocal(taskDto, userTimezone);
        }
        return Ok(taskDtos);
    }

    [HttpPatch("{taskId}/archive")]
    public async Task<IActionResult> ArchiveTaskAsync([FromRoute] long taskId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var taskToArchive = await context.Tasks
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == taskId);
        if (taskToArchive == null)
        {
            _logger.LogWarning("User {currentUserId} tries to archive non existent task {taskId}", CurrentUserId, taskId);
            return BadRequest();
        }

        taskToArchive.ArchivedAt ??= DateTime.UtcNow;
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{taskId}/restore")]
    public async Task<IActionResult> RestoreTaskAsync([FromRoute] long taskId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var taskToRestore = await context.Tasks
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == taskId);
        if (taskToRestore == null)
        {
            _logger.LogWarning("User {currentUserId} tries to restore non existent task {taskId}", CurrentUserId, taskId);
            return BadRequest();
        }

        taskToRestore.ArchivedAt = null;
        await context.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Archives every task currently in the board's done column.</summary>
    [HttpPost("board/{boardId}/archive-done")]
    public async Task<IActionResult> ArchiveDoneTasksAsync([FromRoute] long boardId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var doneTasks = await context.Tasks
            .Where(_ => _.Board.UserId == CurrentUserId && _.BoardId == boardId && _.ArchivedAt == null && _.Column.IsDoneColumn)
            .ToListAsync();

        var utcNow = DateTime.UtcNow;
        foreach (var task in doneTasks)
        {
            task.ArchivedAt = utcNow;
        }

        await context.SaveChangesAsync();
        return Ok(doneTasks.Count);
    }
}
