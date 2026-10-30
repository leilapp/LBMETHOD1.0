using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LBMethod.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TrainingSetPrescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPrescribed",
                table: "TrainingLogSets",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PrescribedNotes",
                table: "TrainingLogSets",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PrescribedRepsMax",
                table: "TrainingLogSets",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PrescribedRepsMin",
                table: "TrainingLogSets",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PrescribedRestSeconds",
                table: "TrainingLogSets",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrescribedRir",
                table: "TrainingLogSets",
                type: "decimal(3,1)",
                precision: 3,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrescribedRpe",
                table: "TrainingLogSets",
                type: "decimal(3,1)",
                precision: 3,
                scale: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrescribedWeight",
                table: "TrainingLogSets",
                type: "decimal(7,2)",
                precision: 7,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PrescribedWeightUnit",
                table: "TrainingLogSets",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPrescribed",
                table: "TrainingLogSets");

            migrationBuilder.DropColumn(
                name: "PrescribedNotes",
                table: "TrainingLogSets");

            migrationBuilder.DropColumn(
                name: "PrescribedRepsMax",
                table: "TrainingLogSets");

            migrationBuilder.DropColumn(
                name: "PrescribedRepsMin",
                table: "TrainingLogSets");

            migrationBuilder.DropColumn(
                name: "PrescribedRestSeconds",
                table: "TrainingLogSets");

            migrationBuilder.DropColumn(
                name: "PrescribedRir",
                table: "TrainingLogSets");

            migrationBuilder.DropColumn(
                name: "PrescribedRpe",
                table: "TrainingLogSets");

            migrationBuilder.DropColumn(
                name: "PrescribedWeight",
                table: "TrainingLogSets");

            migrationBuilder.DropColumn(
                name: "PrescribedWeightUnit",
                table: "TrainingLogSets");
        }
    }
}
