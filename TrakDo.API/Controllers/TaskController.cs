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
            .Where(_ => _.Board.UserId == CurrentUserId && _.BoardId == boardId)
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
        
        taskToMove.ColumnId = newColumnId;

        await context.SaveChangesAsync();
        return NoContent();
    }
}
