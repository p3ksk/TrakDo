using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrakDo.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DateFormat",
                table: "Users",
                type: "longtext",
                nullable: false,
                defaultValue: "YYYY-MM-DD")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                table: "Users",
                type: "longtext",
                nullable: false,
                defaultValue: "UTC")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "Use24HourTime",
                table: "Users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "WorkDayEndHour",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 17);

            migrationBuilder.AddColumn<int>(
                name: "WorkDayStartHour",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 9);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DateFormat",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Timezone",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Use24HourTime",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "WorkDayEndHour",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "WorkDayStartHour",
                table: "Users");
        }
    }
}
