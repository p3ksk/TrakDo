using Microsoft.EntityFrameworkCore;
using TrakDo.API.Models;
using Task = TrakDo.API.Models.Task;

namespace TrakDo.API.Data;

public class TrakDoDbContext : DbContext 
{
    public DbSet<User> Users { get; set; }
    public DbSet<Board> Boards { get; set; }
    public DbSet<Column> Columns { get; set; }
    public DbSet<Session> Sessions { get; set; }
    public DbSet<Task> Tasks { get; set; }
    
    public TrakDoDbContext(DbContextOptions<TrakDoDbContext> opt) : base(opt)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(user =>
        {
            user.HasKey(u => u.Id);
            user.HasIndex(_ => _.Username).IsUnique();
            user.Property(_ => _.Timezone).HasDefaultValue("UTC");
            user.Property(_ => _.DateFormat).HasDefaultValue("YYYY-MM-DD");
            user.Property(_ => _.Use24HourTime).HasDefaultValue(true);
            user.Property(_ => _.WorkDayStartHour).HasDefaultValue(9);
            user.Property(_ => _.WorkDayEndHour).HasDefaultValue(17);
        });

        modelBuilder.Entity<Board>(board =>
        {
            board.HasKey(_ => _.Id);
            board.HasIndex(_ => _.UserId);
            board.HasOne(_ => _.User).WithMany(_ => _.Boards).HasForeignKey(_ => _.UserId);
        });

        modelBuilder.Entity<Column>(column =>
        {
            column.HasKey(_ => _.Id);
            column.HasIndex(_ => _.BoardId);
            column.HasOne(_ => _.Board).WithMany(_ => _.Columns).HasForeignKey(_ => _.BoardId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Task>(task =>
        {
            task.HasKey(_ => _.Id);
            task.HasIndex(_ => _.ColumnId);
            task.HasIndex(_ => _.BoardId);
            task.HasOne(_ => _.Column).WithMany(_ => _.Tasks).HasForeignKey(_ => _.ColumnId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Session>(session =>
        {
            session.HasKey(_ => _.Id);
            session.HasIndex(_ => _.TaskId);
            session.HasOne(_ => _.Task).WithMany(_ => _.Sessions).HasForeignKey(_ => _.TaskId).OnDelete(DeleteBehavior.Cascade);
        });
    }
    
}
