using TrakDo.API.Models;

namespace TrakDo.API.Helpers;

public class DefaultDataHelper
{
    public static List<Column> CreateDefaultColumns(long boardId)
    {
        return new List<Column>
        {
            new Column
            {
                Name = "To Do",
                SortOrder = 1,
                Created = DateTime.UtcNow,
                BoardId = boardId
            },
            new Column
            {
                Name = "In Progress",
                SortOrder = 2,
                Created = DateTime.UtcNow,
                BoardId = boardId
            },
            new Column
            {
                Name = "Done",
                SortOrder = 3,
                Created = DateTime.UtcNow,
                BoardId = boardId
            }
        };
    }
}