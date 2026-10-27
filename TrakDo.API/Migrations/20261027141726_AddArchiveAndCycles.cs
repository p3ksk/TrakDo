using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrakDo.API.Migrations
{
    /// <inheritdoc />
    public partial class AddArchiveAndCycles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AutoArchiveDays",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAt",
                table: "Tasks",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAt",
                table: "Tasks",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "CycleId",
                table: "Tasks",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDoneColumn",
                table: "Columns",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "CycleLengthDays",
                table: "Boards",
                type: "int",
                nullable: false,
                defaultValue: 14);

            migrationBuilder.AddColumn<bool>(
                name: "CyclesEnabled",
                table: "Boards",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "Cycles",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    BoardId = table.Column<long>(type: "bigint", nullable: false),
                    Number = table.Column<int>(type: "int", nullable: false),
                    Goal = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StartDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    CarriedOverCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cycles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Cycles_Boards_BoardId",
                        column: x => x.BoardId,
                        principalTable: "Boards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_CycleId",
                table: "Tasks",
                column: "CycleId");

            migrationBuilder.CreateIndex(
                name: "IX_Cycles_BoardId_Number",
                table: "Cycles",
                columns: new[] { "BoardId", "Number" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Tasks_Cycles_CycleId",
                table: "Tasks",
                column: "CycleId",
                principalTable: "Cycles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // Existing boards: treat the column named "Done" as the done column (first one if several)
            // and consider its tasks completed as of their last change.
            migrationBuilder.Sql("""
                UPDATE Columns c
                JOIN (SELECT BoardId, MIN(Id) AS Id FROM Columns WHERE LOWER(TRIM(Name)) = 'done' GROUP BY BoardId) d ON c.Id = d.Id
                SET c.IsDoneColumn = 1;
                """);
            migrationBuilder.Sql("""
                UPDATE Tasks t
                JOIN Columns c ON t.ColumnId = c.Id
                SET t.CompletedAt = COALESCE(t.Updated, t.Created)
                WHERE c.IsDoneColumn = 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tasks_Cycles_CycleId",
                table: "Tasks");

            migrationBuilder.DropTable(
                name: "Cycles");

            migrationBuilder.DropIndex(
                name: "IX_Tasks_CycleId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "AutoArchiveDays",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "CycleId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "IsDoneColumn",
                table: "Columns");

            migrationBuilder.DropColumn(
                name: "CycleLengthDays",
                table: "Boards");

            migrationBuilder.DropColumn(
                name: "CyclesEnabled",
                table: "Boards");
        }
    }
}
