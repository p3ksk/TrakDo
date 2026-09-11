using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrakDo.API.Data;
using TrakDo.API.Dtos;
using TrakDo.API.Dtos.Board;
using TrakDo.API.Dtos.Column;
using TrakDo.API.Helpers;
using TrakDo.API.Models;
using Task = TrakDo.API.Models.Task;

namespace TrakDo.API.Controllers;

public class BoardController : V1BaseController
{
    private readonly ILogger<BoardController> _logger;
    private readonly IDbContextFactory<TrakDoDbContext> _contextFactory;

    public BoardController(ILogger<BoardController> logger, IDbContextFactory<TrakDoDbContext> contextFactory)
    {
        _logger = logger;
        _contextFactory = contextFactory;
    }

    #region Boards
    
    [HttpGet("list")]
    public async Task<IActionResult> GetBoardAsync()
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var boards = await context.Boards.Where(_ => _.UserId == CurrentUserId).ToListAsync();
        foreach (var board in boards)
        {
            UserDateTimeHelper.ConvertBoardToUserLocal(board, timezone);
        }
        return Ok(boards);
    }
    
    [HttpPost("create")]
    public async Task<IActionResult> CreateBoardAsync([FromBody] NewBoardDto board)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var newBoard = board.ToBoard();
        newBoard.UserId = CurrentUserId;
        newBoard.Created = DateTime.UtcNow;
        
        var createdBoard = (await context.Boards.AddAsync(newBoard)).Entity;
        createdBoard.Columns = DefaultDataHelper.CreateDefaultColumns(createdBoard.Id);
        await context.SaveChangesAsync();
        return Ok(createdBoard.Id);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBoardByIdAsync([FromRoute] long id, [FromQuery] bool includeSessions = true)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var query = context.Boards.Where(_ => _.UserId == CurrentUserId && _.Id == id).AsQueryable();
        if (includeSessions)
        {
            query = query.Include(_ => _.Columns)
                .ThenInclude(c => c.Tasks)
                .ThenInclude(t => t.Sessions);
        }

        var board = await query.SingleOrDefaultAsync();
        if (board == null)
        {
            _logger.LogWarning("User {currentUserId} looking for non existent board with id {boardId}", CurrentUserId, id);
            return BadRequest();
        }
        
        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var boardDto = board.ToBoardDto();
        UserDateTimeHelper.ConvertBoardDtoToUserLocal(boardDto, timezone);
        return Ok(boardDto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateBoardAsync([FromRoute] long id, [FromBody] NewBoardDto board)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var boardToUpdate = await context.Boards.SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == id);
        if (boardToUpdate == null)
        {
            _logger.LogWarning("User {currentUserId} trying to update non existent board with id {boardId}", CurrentUserId, id);
            return BadRequest();
        }

        boardToUpdate.Updated = DateTime.UtcNow;
        boardToUpdate.SortOrder = board.SortOrder;
        boardToUpdate.Color = board.Color;
        boardToUpdate.Name = board.Name;
        boardToUpdate.Description = board.Description;
        
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBoardAsync([FromRoute] long id)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var boardToUpdate = await context.Boards.SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == id);
        if (boardToUpdate == null)
        {
            _logger.LogWarning("User {currentUserId} trying to delete non existent board with id {boardId}",
                CurrentUserId, id);
            return BadRequest();
        }

        context.Boards.Remove(boardToUpdate);
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("reorder")]
    public async Task<IActionResult> ReorderBoard([FromBody] ReorderRequest reorderRequest)
    {
        long[] objectsToReorder = reorderRequest.ObjectIdsToReorder;
        await using var context = await _contextFactory.CreateDbContextAsync();
        var relevantBoards = context.Boards.Where(_ => _.UserId == CurrentUserId && objectsToReorder.Contains(_.Id));
        foreach (var board in relevantBoards)
        {
            board.SortOrder = reorderRequest.ReorderObjects.Single(_ => _.ObjectId == board.Id).SortOrder;
        }
        
        await context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Columns

    [HttpGet("{boardId}/columns")]
    public async Task<IActionResult> GetColumnsAsync([FromRoute] long boardId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var timezone = await UserDateTimeHelper.GetUserTimezoneAsync(context, CurrentUserId);
        var columns = await context.Columns
            .Include(_ => _.Tasks).ThenInclude(_ => _.Sessions)
            .Where(_ => _.Board.UserId == CurrentUserId && _.BoardId == boardId).ToArrayAsync();
        var columnDtos = columns.Select(column => column.ToColumnDto()).ToArray();
        foreach (var column in columnDtos)
        {
            UserDateTimeHelper.ConvertColumnDtoToUserLocal(column, timezone);
        }
        return Ok(columnDtos);
    }

    [HttpPost("{boardId}/columns")]
    public async Task<IActionResult> CreateColumnAsync([FromRoute] long boardId, [FromBody] NewColumnDto column)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var board = await context.Boards.Include(_ => _.Columns)
            .SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == boardId);
        if (board == null)
        {
            _logger.LogWarning("User {currentUserId} tries to add column to board {boardId}", CurrentUserId, boardId);
            return BadRequest();
        }

        var newColumn = column.ToColumn();
        board.Columns.Add(newColumn);
        await context.SaveChangesAsync();
        return Ok(newColumn.Id);
    }

    [HttpPut("{boardId}/columns/{columnId}")]
    public async Task<IActionResult> UpdateColumnAsync([FromRoute] long boardId, [FromRoute] long columnId, [FromBody] UpdateColumnDto column)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var board = await context.Boards.Include(_ => _.Columns)
            .SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == boardId);
        if (board == null)
        {
            _logger.LogWarning("User {currentUserId} tries to update column in non existent board {boardId}", CurrentUserId, boardId);
            return BadRequest();
        }

        var columnToEdit = board.Columns.Single(_ => _.Id == columnId);
        columnToEdit.Name = column.Name;
        columnToEdit.SortOrder = column.SortOrder;
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{boardId}/columns/{columnId}")]
    public async Task<IActionResult> DeleteColumnAsync([FromRoute] long boardId, [FromRoute] long columnId)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var board = await context.Boards.Include(_ => _.Columns)
            .SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == boardId);
        if (board == null)
        {
            _logger.LogWarning("User {currentUserId} tries to delete column in non existent board {boardId}", CurrentUserId, boardId);
            return BadRequest();
        }
        
        var columnToDelete = board.Columns.Single(_ => _.Id == columnId);
        context.Columns.Remove(columnToDelete);
        await context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("{boardId}/columns/reorder")]
    public async Task<IActionResult> ReorderColumns([FromRoute] long boardId, [FromBody] ReorderRequest reorderRequest)
    {
        await using var context = await _contextFactory.CreateDbContextAsync();
        var board = await context.Boards.Include(_ => _.Columns)
            .SingleOrDefaultAsync(_ => _.UserId == CurrentUserId && _.Id == boardId);
        if (board == null)
        {
            _logger.LogWarning("User {currentUserId} tries to reorder columns in non existent board {boardId}", CurrentUserId, boardId);
            return BadRequest();
        }
        
        var objectsToReorder = reorderRequest.ObjectIdsToReorder;
        var columnsToReorder = board.Columns.Where(_ => objectsToReorder.Contains(_.Id));
        foreach (var column in columnsToReorder)
        {
            column.SortOrder = reorderRequest.ReorderObjects.Single(_ => _.ObjectId == column.Id).SortOrder;
        }
        await context.SaveChangesAsync();
        return NoContent();
    }

    #endregion
}
