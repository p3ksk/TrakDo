using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrakDo.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionNotesColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                SET @column_exists := (
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Sessions'
                      AND COLUMN_NAME = 'Notes'
                );
                SET @sql := IF(
                    @column_exists = 0,
                    'ALTER TABLE `Sessions` ADD COLUMN `Notes` longtext NOT NULL DEFAULT '''';',
                    'SELECT 1;'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                SET @column_exists := (
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Sessions'
                      AND COLUMN_NAME = 'Notes'
                );
                SET @sql := IF(
                    @column_exists = 1,
                    'ALTER TABLE `Sessions` DROP COLUMN `Notes`;',
                    'SELECT 1;'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");
        }
    }
}
