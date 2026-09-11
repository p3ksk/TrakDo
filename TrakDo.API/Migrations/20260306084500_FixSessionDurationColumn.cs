using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using TrakDo.API.Data;

#nullable disable

namespace TrakDo.API.Migrations
{
    [DbContext(typeof(TrakDoDbContext))]
    [Migration("20260306084500_FixSessionDurationColumn")]
    public partial class FixSessionDurationColumn : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                SET @duration_exists := (
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Sessions'
                      AND COLUMN_NAME = 'Duration'
                );

                SET @duration_minutes_exists := (
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Sessions'
                      AND COLUMN_NAME = 'DurationMinutes'
                );

                SET @sql := IF(
                    @duration_exists = 0,
                    'ALTER TABLE `Sessions` ADD COLUMN `Duration` int NULL;',
                    'SELECT 1;'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;

                SET @sql := IF(
                    @duration_exists = 0 AND @duration_minutes_exists = 1,
                    'UPDATE `Sessions` SET `Duration` = `DurationMinutes` WHERE `Duration` IS NULL;',
                    'SELECT 1;'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                SET @duration_exists := (
                    SELECT COUNT(*)
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'Sessions'
                      AND COLUMN_NAME = 'Duration'
                );

                SET @sql := IF(
                    @duration_exists = 1,
                    'ALTER TABLE `Sessions` DROP COLUMN `Duration`;',
                    'SELECT 1;'
                );
                PREPARE stmt FROM @sql;
                EXECUTE stmt;
                DEALLOCATE PREPARE stmt;
            ");
        }
    }
}
