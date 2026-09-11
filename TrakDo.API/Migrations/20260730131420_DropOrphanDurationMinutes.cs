using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrakDo.API.Migrations
{
    /// <inheritdoc />
    public partial class DropOrphanDurationMinutes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE Sessions DROP COLUMN IF EXISTS DurationMinutes;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Nothing to do — column was orphaned and never managed by EF
        }
    }
}
