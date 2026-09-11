using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Dtos.Session;
using TrakDo.API.Helpers;
using TrakDo.API.Models;

namespace TrakDo.API.Controllers;

public class SessionsController : V1BaseController
{
    private readonly ILogger<SessionsController> _logger;
    private readonly IDbContextFactory<TrakDoDbContext> _contextFactory;

    public SessionsController(ILogger<SessionsController> logger, IDbContextFactory<TrakDoDbContext> contextFactory)
    {
        _logger = logger;
        _contextFactory = contextFactory;
    }
    
    [HttpGet("tasks/{taskId}/sessions")]
    public async Task<IActionResult> GetSessionsAsync([FromRoute] long taskId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var userTask = await context.Tasks
            .Include(t => t.Board)
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == taskId);
        if (userTask == null)
        {
            _logger.LogWarning("User {currentUserId} tries to get sessions for non existent task {taskId}", CurrentUserId, taskId);
            return BadRequest();
        }
        
        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var sessions = await context.Sessions
            .Include(s => s.Task)
            .Where(s => s.TaskId == taskId)
            .ToArrayAsync();
        var sessionDtos = sessions.Select(session => session.ToSessionDto()).ToArray();
        foreach (var session in sessionDtos)
        {
            UserDateTimeHelper.ConvertSessionDtoToUserLocal(session, timezone);
        }
        return Ok(sessionDtos);
    }

    [HttpGet]
    public async Task<IActionResult> GetUserSessionsAsync([FromQuery] DateTime? start = null, [FromQuery] DateTime? end = null, [FromQuery] long? boardId = null)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var startUtc = UserDateTimeHelper.ConvertUserLocalToUtc(start, timezone);
        var endUtc = UserDateTimeHelper.ConvertUserLocalToUtc(end, timezone);
        var query = context.Sessions
            .Include(s => s.Task)
            .Where(s => s.Task.Board.UserId == CurrentUserId);

        if (boardId.HasValue)
        {
            query = query.Where(s => s.Task.BoardId == boardId.Value);
        }

        if (startUtc.HasValue && endUtc.HasValue)
        {
            query = query.Where(s =>
                s.StartTime <= endUtc.Value &&
                (!s.EndTime.HasValue || s.EndTime.Value >= startUtc.Value));
        }
        else if (startUtc.HasValue)
        {
            query = query.Where(s => !s.EndTime.HasValue || s.EndTime.Value >= startUtc.Value);
        }
        else if (endUtc.HasValue)
        {
            query = query.Where(s => s.StartTime <= endUtc.Value);
        }

        var sessions = await query.ToArrayAsync();
        var sessionDtos = sessions.Select(session => session.ToSessionDto()).ToArray();
        foreach (var session in sessionDtos)
        {
            UserDateTimeHelper.ConvertSessionDtoToUserLocal(session, timezone);
        }

        return Ok(sessionDtos);
    }

    [HttpPost("tasks/{taskId}/sessions/start")]
    public async Task<IActionResult> StartSessionAsync([FromRoute] long taskId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var userTask = await context.Tasks
            .Include(t => t.Board)
            .SingleOrDefaultAsync(_ => _.Board.UserId == CurrentUserId && _.Id == taskId);
        if (userTask == null)
        {
            _logger.LogWarning("User {currentUserId} tries to get sessions for non existent task {taskId}", CurrentUserId, taskId);
            return BadRequest();
        }

        var newSession = new Session
        {
            TaskId = taskId,
            StartTime = DateTime.UtcNow,
            Notes = string.Empty,
            Task = userTask
        };
        context.Sessions.Add(newSession);
        await context.SaveChangesAsync();
        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var sessionDto = newSession.ToSessionDto();
        UserDateTimeHelper.ConvertSessionDtoToUserLocal(sessionDto, timezone);
        return Ok(sessionDto);
    }


    [HttpPatch("{sessionId}/stop")]
    public async Task<IActionResult> StopSessionAsync([FromRoute] long sessionId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var userSession = await context.Sessions
            .Include(t => t.Task)
            .SingleOrDefaultAsync(_ => _.Task.Board.UserId == CurrentUserId && _.Id == sessionId);
        if (userSession == null)
        {
            _logger.LogWarning("User {currentUserId} tries to stop non existent session {sessionId}", CurrentUserId, sessionId);
            return BadRequest();
        }

        var stopTime = DateTime.UtcNow;
        userSession.EndTime = stopTime;
        userSession.Duration = (int)(stopTime - userSession.StartTime).TotalSeconds;
        await context.SaveChangesAsync();
        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var sessionDto = userSession.ToSessionDto();
        UserDateTimeHelper.ConvertSessionDtoToUserLocal(sessionDto, timezone);
        return Ok(sessionDto);
    }

    [HttpPut("{sessionId}")]
    public async Task<IActionResult> UpdateSessionAsync([FromRoute] long sessionId, [FromBody] UpdateSessionRequest session)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var userSession = await context.Sessions
            .Include(t => t.Task)
            .SingleOrDefaultAsync(_ => _.Task.Board.UserId == CurrentUserId && _.Id == sessionId);
        if (userSession == null)
        {
            _logger.LogWarning("User {currentUserId} tries to update non existent session {sessionId}", CurrentUserId, sessionId);
            return BadRequest();
        }

        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var startUtc = UserDateTimeHelper.ConvertUserLocalToUtc(session.StartTime, timezone);
        var endUtc = UserDateTimeHelper.ConvertUserLocalToUtc(session.EndTime, timezone);

        if (endUtc.HasValue && startUtc > endUtc.Value)
        {
            _logger.LogWarning("User {currentUserId} tries to update session {sessionId} with invalid time range", CurrentUserId, sessionId);
            return BadRequest();
        }
        
        userSession.StartTime = startUtc;
        userSession.EndTime = endUtc;
        userSession.Notes = session.Notes ?? string.Empty;
        if (endUtc.HasValue)
        {
            userSession.Duration = (int)(endUtc.Value - startUtc).TotalSeconds;
        }
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{sessionId}")]
    public async Task<IActionResult> DeleteSessionAsync([FromRoute] long sessionId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var userSession = await context.Sessions
            .Include(t => t.Task)
            .SingleOrDefaultAsync(_ => _.Task.Board.UserId == CurrentUserId && _.Id == sessionId);
        if (userSession == null)
        {
            _logger.LogWarning("User {currentUserId} tries to delete non existent session {sessionId}", CurrentUserId, sessionId);
            return BadRequest();
        }
        
        context.Sessions.Remove(userSession);
        await context.SaveChangesAsync();
        return NoContent();
    }
}
