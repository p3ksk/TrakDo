namespace TrakDo.API.Dtos;

public class ReorderRequest
{
    public ReorderObject[] ReorderObjects { get; set; }
    
    public long[] ObjectIdsToReorder => ReorderObjects.Select(o => o.ObjectId).ToArray();
}

public class ReorderObject
{
    public long ObjectId { get; set; }
    public int SortOrder { get; set; }
}