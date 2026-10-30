using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace LBMethod.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DisplayName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SecurityStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "bit", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "bit", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Details = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Equipment",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NameEs = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Equipment", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MeasurementTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NameEs = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeasurementTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MovementPatterns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NameEs = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MovementPatterns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MuscleGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NameEs = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MuscleGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Clients",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TrainerId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    BirthDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Height = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    HeightUnit = table.Column<int>(type: "int", nullable: true),
                    Weight = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: true),
                    WeightUnit = table.Column<int>(type: "int", nullable: true),
                    ExperienceLevel = table.Column<int>(type: "int", nullable: true),
                    Goal = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TrainingLocation = table.Column<int>(type: "int", nullable: true),
                    AvailableDays = table.Column<int>(type: "int", nullable: false),
                    SessionDurationMinutes = table.Column<int>(type: "int", nullable: true),
                    DeclaredLimitations = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    DeactivatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clients", x => x.Id);
                    table.CheckConstraint("CK_Clients_Height", "[Height] IS NULL OR ([Height] > 0 AND [HeightUnit] IS NOT NULL)");
                    table.CheckConstraint("CK_Clients_SessionDuration", "[SessionDurationMinutes] IS NULL OR [SessionDurationMinutes] > 0");
                    table.CheckConstraint("CK_Clients_Weight", "[Weight] IS NULL OR ([Weight] > 0 AND [WeightUnit] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_Clients_AspNetUsers_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Clients_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Routines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TrainerId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ArchivedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Routines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Routines_AspNetUsers_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Exercises",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NameEs = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Instructions = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    CommonMistakes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    TechnicalTips = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Difficulty = table.Column<int>(type: "int", nullable: true),
                    MovementPatternId = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    DeactivatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Exercises", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Exercises_MovementPatterns_MovementPatternId",
                        column: x => x.MovementPatternId,
                        principalTable: "MovementPatterns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientNotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ClientId = table.Column<int>(type: "int", nullable: false),
                    AuthorUserId = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClientNotes_AspNetUsers_AuthorUserId",
                        column: x => x.AuthorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientNotes_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Evaluations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ClientId = table.Column<int>(type: "int", nullable: false),
                    EvaluatedOn = table.Column<DateOnly>(type: "date", nullable: false),
                    PerformedByUserId = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Evaluations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Evaluations_AspNetUsers_PerformedByUserId",
                        column: x => x.PerformedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Evaluations_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StoredFiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Purpose = table.Column<int>(type: "int", nullable: false),
                    OwnerClientId = table.Column<int>(type: "int", nullable: true),
                    UploadedByUserId = table.Column<int>(type: "int", nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Sha256 = table.Column<string>(type: "nchar(64)", fixedLength: true, maxLength: 64, nullable: true),
                    StorageProvider = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    StorageKey = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoredFiles", x => x.Id);
                    table.CheckConstraint("CK_StoredFiles_Size", "[SizeBytes] > 0");
                    table.ForeignKey(
                        name: "FK_StoredFiles_AspNetUsers_UploadedByUserId",
                        column: x => x.UploadedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StoredFiles_Clients_OwnerClientId",
                        column: x => x.OwnerClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RoutineVersions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoutineId = table.Column<int>(type: "int", nullable: false),
                    VersionNumber = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Goal = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DurationWeeks = table.Column<int>(type: "int", nullable: true),
                    ChangeNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SourceVersionId = table.Column<int>(type: "int", nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PublishedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoutineVersions", x => x.Id);
                    table.CheckConstraint("CK_RoutineVersions_Duration", "[DurationWeeks] IS NULL OR [DurationWeeks] > 0");
                    table.CheckConstraint("CK_RoutineVersions_Published", "[Status] <> 2 OR [PublishedAt] IS NOT NULL");
                    table.CheckConstraint("CK_RoutineVersions_VersionNumber", "[VersionNumber] >= 1");
                    table.ForeignKey(
                        name: "FK_RoutineVersions_AspNetUsers_PublishedByUserId",
                        column: x => x.PublishedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoutineVersions_RoutineVersions_SourceVersionId",
                        column: x => x.SourceVersionId,
                        principalTable: "RoutineVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoutineVersions_Routines_RoutineId",
                        column: x => x.RoutineId,
                        principalTable: "Routines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseEquipment",
                columns: table => new
                {
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    EquipmentId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseEquipment", x => new { x.ExerciseId, x.EquipmentId });
                    table.ForeignKey(
                        name: "FK_ExerciseEquipment_Equipment_EquipmentId",
                        column: x => x.EquipmentId,
                        principalTable: "Equipment",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ExerciseEquipment_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseFavorites",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseFavorites", x => new { x.UserId, x.ExerciseId });
                    table.ForeignKey(
                        name: "FK_ExerciseFavorites_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ExerciseFavorites_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseMuscles",
                columns: table => new
                {
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    MuscleGroupId = table.Column<int>(type: "int", nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseMuscles", x => new { x.ExerciseId, x.MuscleGroupId });
                    table.ForeignKey(
                        name: "FK_ExerciseMuscles_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExerciseMuscles_MuscleGroups_MuscleGroupId",
                        column: x => x.MuscleGroupId,
                        principalTable: "MuscleGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseVariants",
                columns: table => new
                {
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    VariantExerciseId = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseVariants", x => new { x.ExerciseId, x.VariantExerciseId });
                    table.CheckConstraint("CK_ExerciseVariants_NotSelf", "[ExerciseId] <> [VariantExerciseId]");
                    table.ForeignKey(
                        name: "FK_ExerciseVariants_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ExerciseVariants_Exercises_VariantExerciseId",
                        column: x => x.VariantExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Measurements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ClientId = table.Column<int>(type: "int", nullable: false),
                    MeasurementTypeId = table.Column<int>(type: "int", nullable: false),
                    EvaluationId = table.Column<int>(type: "int", nullable: true),
                    MeasuredOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    RecordedByUserId = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Measurements", x => x.Id);
                    table.CheckConstraint("CK_Measurements_Value", "[Value] > 0");
                    table.ForeignKey(
                        name: "FK_Measurements_AspNetUsers_RecordedByUserId",
                        column: x => x.RecordedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Measurements_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Measurements_Evaluations_EvaluationId",
                        column: x => x.EvaluationId,
                        principalTable: "Evaluations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Measurements_MeasurementTypes_MeasurementTypeId",
                        column: x => x.MeasurementTypeId,
                        principalTable: "MeasurementTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ExerciseMedia",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    MediaType = table.Column<int>(type: "int", nullable: false),
                    StoredFileId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ExternalUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExerciseMedia", x => x.Id);
                    table.CheckConstraint("CK_ExerciseMedia_OneSource", "([StoredFileId] IS NOT NULL AND [ExternalUrl] IS NULL) OR ([StoredFileId] IS NULL AND [ExternalUrl] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_ExerciseMedia_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExerciseMedia_StoredFiles_StoredFileId",
                        column: x => x.StoredFileId,
                        principalTable: "StoredFiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProgressPhotos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ClientId = table.Column<int>(type: "int", nullable: false),
                    StoredFileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EvaluationId = table.Column<int>(type: "int", nullable: true),
                    TakenOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Category = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgressPhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgressPhotos_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgressPhotos_Evaluations_EvaluationId",
                        column: x => x.EvaluationId,
                        principalTable: "Evaluations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgressPhotos_StoredFiles_StoredFileId",
                        column: x => x.StoredFileId,
                        principalTable: "StoredFiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RoutineAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ClientId = table.Column<int>(type: "int", nullable: false),
                    RoutineVersionId = table.Column<int>(type: "int", nullable: false),
                    AssignedByUserId = table.Column<int>(type: "int", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    StatusChangedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoutineAssignments", x => x.Id);
                    table.CheckConstraint("CK_RoutineAssignments_Dates", "[EndDate] IS NULL OR [EndDate] >= [StartDate]");
                    table.ForeignKey(
                        name: "FK_RoutineAssignments_AspNetUsers_AssignedByUserId",
                        column: x => x.AssignedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoutineAssignments_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoutineAssignments_RoutineVersions_RoutineVersionId",
                        column: x => x.RoutineVersionId,
                        principalTable: "RoutineVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RoutineDays",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoutineVersionId = table.Column<int>(type: "int", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DayOfWeek = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoutineDays", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoutineDays_RoutineVersions_RoutineVersionId",
                        column: x => x.RoutineVersionId,
                        principalTable: "RoutineVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RoutineExercises",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoutineDayId = table.Column<int>(type: "int", nullable: false),
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    SupersetGroup = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Sets = table.Column<int>(type: "int", nullable: false),
                    RepsMin = table.Column<int>(type: "int", nullable: true),
                    RepsMax = table.Column<int>(type: "int", nullable: true),
                    SuggestedWeight = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    SuggestedWeightUnit = table.Column<int>(type: "int", nullable: true),
                    RestSeconds = table.Column<int>(type: "int", nullable: true),
                    Tempo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Rir = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    Rpe = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    SetType = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoutineExercises", x => x.Id);
                    table.CheckConstraint("CK_RoutineExercises_Reps", "([RepsMin] IS NULL OR [RepsMin] >= 0) AND ([RepsMax] IS NULL OR [RepsMax] >= 0) AND ([RepsMin] IS NULL OR [RepsMax] IS NULL OR [RepsMin] <= [RepsMax])");
                    table.CheckConstraint("CK_RoutineExercises_Rest", "[RestSeconds] IS NULL OR [RestSeconds] >= 0");
                    table.CheckConstraint("CK_RoutineExercises_Rir", "[Rir] IS NULL OR ([Rir] >= 0 AND [Rir] <= 10)");
                    table.CheckConstraint("CK_RoutineExercises_Rpe", "[Rpe] IS NULL OR ([Rpe] >= 1 AND [Rpe] <= 10)");
                    table.CheckConstraint("CK_RoutineExercises_Sets", "[Sets] >= 1");
                    table.CheckConstraint("CK_RoutineExercises_Weight", "[SuggestedWeight] IS NULL OR ([SuggestedWeight] >= 0 AND [SuggestedWeightUnit] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_RoutineExercises_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoutineExercises_RoutineDays_RoutineDayId",
                        column: x => x.RoutineDayId,
                        principalTable: "RoutineDays",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrainingLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ClientId = table.Column<int>(type: "int", nullable: false),
                    RoutineAssignmentId = table.Column<int>(type: "int", nullable: true),
                    RoutineDayId = table.Column<int>(type: "int", nullable: true),
                    RoutineTitle = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    RoutineVersionNumber = table.Column<int>(type: "int", nullable: true),
                    DayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingLogs", x => x.Id);
                    table.CheckConstraint("CK_TrainingLogs_Completed", "[Status] <> 2 OR [CompletedAt] IS NOT NULL");
                    table.CheckConstraint("CK_TrainingLogs_Dates", "[CompletedAt] IS NULL OR [CompletedAt] >= [StartedAt]");
                    table.ForeignKey(
                        name: "FK_TrainingLogs_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TrainingLogs_RoutineAssignments_RoutineAssignmentId",
                        column: x => x.RoutineAssignmentId,
                        principalTable: "RoutineAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TrainingLogs_RoutineDays_RoutineDayId",
                        column: x => x.RoutineDayId,
                        principalTable: "RoutineDays",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RoutineExerciseSets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoutineExerciseId = table.Column<int>(type: "int", nullable: false),
                    SetNumber = table.Column<int>(type: "int", nullable: false),
                    SetType = table.Column<int>(type: "int", nullable: false),
                    RepsMin = table.Column<int>(type: "int", nullable: true),
                    RepsMax = table.Column<int>(type: "int", nullable: true),
                    SuggestedWeight = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    SuggestedWeightUnit = table.Column<int>(type: "int", nullable: true),
                    RestSeconds = table.Column<int>(type: "int", nullable: true),
                    Rir = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    Rpe = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoutineExerciseSets", x => x.Id);
                    table.CheckConstraint("CK_RoutineExerciseSets_Reps", "([RepsMin] IS NULL OR [RepsMin] >= 0) AND ([RepsMax] IS NULL OR [RepsMax] >= 0) AND ([RepsMin] IS NULL OR [RepsMax] IS NULL OR [RepsMin] <= [RepsMax])");
                    table.CheckConstraint("CK_RoutineExerciseSets_Rest", "[RestSeconds] IS NULL OR [RestSeconds] >= 0");
                    table.CheckConstraint("CK_RoutineExerciseSets_Rir", "[Rir] IS NULL OR ([Rir] >= 0 AND [Rir] <= 10)");
                    table.CheckConstraint("CK_RoutineExerciseSets_Rpe", "[Rpe] IS NULL OR ([Rpe] >= 1 AND [Rpe] <= 10)");
                    table.CheckConstraint("CK_RoutineExerciseSets_SetNumber", "[SetNumber] >= 1");
                    table.CheckConstraint("CK_RoutineExerciseSets_Weight", "[SuggestedWeight] IS NULL OR ([SuggestedWeight] >= 0 AND [SuggestedWeightUnit] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_RoutineExerciseSets_RoutineExercises_RoutineExerciseId",
                        column: x => x.RoutineExerciseId,
                        principalTable: "RoutineExercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CalendarEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TrainerId = table.Column<int>(type: "int", nullable: false),
                    ClientId = table.Column<int>(type: "int", nullable: true),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    EndTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RoutineAssignmentId = table.Column<int>(type: "int", nullable: true),
                    RoutineDayId = table.Column<int>(type: "int", nullable: true),
                    TrainingLogId = table.Column<int>(type: "int", nullable: true),
                    EvaluationId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEvents", x => x.Id);
                    table.CheckConstraint("CK_CalendarEvents_Times", "[EndTime] IS NULL OR ([StartTime] IS NOT NULL AND [EndTime] >= [StartTime])");
                    table.ForeignKey(
                        name: "FK_CalendarEvents_AspNetUsers_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_Clients_ClientId",
                        column: x => x.ClientId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_Evaluations_EvaluationId",
                        column: x => x.EvaluationId,
                        principalTable: "Evaluations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_RoutineAssignments_RoutineAssignmentId",
                        column: x => x.RoutineAssignmentId,
                        principalTable: "RoutineAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_RoutineDays_RoutineDayId",
                        column: x => x.RoutineDayId,
                        principalTable: "RoutineDays",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_TrainingLogs_TrainingLogId",
                        column: x => x.TrainingLogId,
                        principalTable: "TrainingLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TrainingLogExercises",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TrainingLogId = table.Column<int>(type: "int", nullable: false),
                    ExerciseId = table.Column<int>(type: "int", nullable: false),
                    RoutineExerciseId = table.Column<int>(type: "int", nullable: true),
                    Position = table.Column<int>(type: "int", nullable: false),
                    ExerciseNameEs = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ExerciseNameEn = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    SupersetGroup = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    PrescribedSets = table.Column<int>(type: "int", nullable: true),
                    PrescribedRepsMin = table.Column<int>(type: "int", nullable: true),
                    PrescribedRepsMax = table.Column<int>(type: "int", nullable: true),
                    PrescribedWeight = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    PrescribedWeightUnit = table.Column<int>(type: "int", nullable: true),
                    PrescribedRestSeconds = table.Column<int>(type: "int", nullable: true),
                    PrescribedTempo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PrescribedRir = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    PrescribedRpe = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    PrescribedNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IsCompleted = table.Column<bool>(type: "bit", nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingLogExercises", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainingLogExercises_Exercises_ExerciseId",
                        column: x => x.ExerciseId,
                        principalTable: "Exercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TrainingLogExercises_RoutineExercises_RoutineExerciseId",
                        column: x => x.RoutineExerciseId,
                        principalTable: "RoutineExercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TrainingLogExercises_TrainingLogs_TrainingLogId",
                        column: x => x.TrainingLogId,
                        principalTable: "TrainingLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrainingLogSets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TrainingLogExerciseId = table.Column<int>(type: "int", nullable: false),
                    SetNumber = table.Column<int>(type: "int", nullable: false),
                    SetType = table.Column<int>(type: "int", nullable: false),
                    Reps = table.Column<int>(type: "int", nullable: true),
                    Weight = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: true),
                    WeightUnit = table.Column<int>(type: "int", nullable: true),
                    Rir = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    Rpe = table.Column<decimal>(type: "decimal(3,1)", precision: 3, scale: 1, nullable: true),
                    IsCompleted = table.Column<bool>(type: "bit", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingLogSets", x => x.Id);
                    table.CheckConstraint("CK_TrainingLogSets_Reps", "[Reps] IS NULL OR [Reps] >= 0");
                    table.CheckConstraint("CK_TrainingLogSets_Rir", "[Rir] IS NULL OR ([Rir] >= 0 AND [Rir] <= 10)");
                    table.CheckConstraint("CK_TrainingLogSets_Rpe", "[Rpe] IS NULL OR ([Rpe] >= 1 AND [Rpe] <= 10)");
                    table.CheckConstraint("CK_TrainingLogSets_SetNumber", "[SetNumber] >= 1");
                    table.CheckConstraint("CK_TrainingLogSets_Weight", "[Weight] IS NULL OR ([Weight] >= 0 AND [WeightUnit] IS NOT NULL)");
                    table.ForeignKey(
                        name: "FK_TrainingLogSets_TrainingLogExercises_TrainingLogExerciseId",
                        column: x => x.TrainingLogExerciseId,
                        principalTable: "TrainingLogExercises",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "AspNetRoles",
                columns: new[] { "Id", "ConcurrencyStamp", "Name", "NormalizedName" },
                values: new object[,]
                {
                    { 1, "b6d1f0c2-5a2e-4f7e-9d3a-000000000001", "TRAINER", "TRAINER" },
                    { 2, "b6d1f0c2-5a2e-4f7e-9d3a-000000000002", "CLIENT", "CLIENT" }
                });

            migrationBuilder.InsertData(
                table: "MeasurementTypes",
                columns: new[] { "Id", "CreatedAt", "IsActive", "Kind", "NameEn", "NameEs", "SortOrder", "Unit", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, 1, "Body weight", "Peso corporal", 1, "kg", new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 2, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, 2, "Waist", "Cintura", 2, "cm", new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 3, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, 2, "Hips", "Cadera", 3, "cm", new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 4, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, 2, "Glutes", "Glúteos", 4, "cm", new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 5, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, 2, "Thigh", "Muslo", 5, "cm", new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 6, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, 2, "Arm", "Brazo", 6, "cm", new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 7, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, 2, "Calf", "Pantorrilla", 7, "cm", new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.InsertData(
                table: "MuscleGroups",
                columns: new[] { "Id", "CreatedAt", "IsActive", "NameEn", "NameEs", "SortOrder", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Glutes", "Glúteos", 1, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 2, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Hamstrings", "Femoral", 2, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 3, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Quadriceps", "Cuádriceps", 3, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 4, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Abductors", "Abductores", 4, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 5, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Adductors", "Aductores", 5, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 6, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Calves", "Pantorrillas", 6, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 7, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Back", "Espalda", 7, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 8, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Chest", "Pecho", 8, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 9, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Shoulders", "Hombros", 9, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 10, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Biceps", "Bíceps", 10, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 11, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Triceps", "Tríceps", 11, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 12, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), true, "Abs", "Abdomen", 12, new DateTime(2026, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true,
                filter: "[NormalizedName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true,
                filter: "[NormalizedUserName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityType_EntityId",
                table: "AuditLogs",
                columns: new[] { "EntityType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_OccurredAt",
                table: "AuditLogs",
                column: "OccurredAt");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId",
                table: "AuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_ClientId_Date",
                table: "CalendarEvents",
                columns: new[] { "ClientId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_EvaluationId",
                table: "CalendarEvents",
                column: "EvaluationId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_RoutineAssignmentId",
                table: "CalendarEvents",
                column: "RoutineAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_RoutineDayId",
                table: "CalendarEvents",
                column: "RoutineDayId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_TrainerId_Date",
                table: "CalendarEvents",
                columns: new[] { "TrainerId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_TrainingLogId",
                table: "CalendarEvents",
                column: "TrainingLogId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientNotes_AuthorUserId",
                table: "ClientNotes",
                column: "AuthorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ClientNotes_ClientId_CreatedAt",
                table: "ClientNotes",
                columns: new[] { "ClientId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Clients_Email",
                table: "Clients",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clients_TrainerId_Status",
                table: "Clients",
                columns: new[] { "TrainerId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Clients_UserId",
                table: "Clients",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Equipment_NameEn",
                table: "Equipment",
                column: "NameEn",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Equipment_NameEs",
                table: "Equipment",
                column: "NameEs",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Evaluations_ClientId_EvaluatedOn",
                table: "Evaluations",
                columns: new[] { "ClientId", "EvaluatedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_Evaluations_PerformedByUserId",
                table: "Evaluations",
                column: "PerformedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseEquipment_EquipmentId",
                table: "ExerciseEquipment",
                column: "EquipmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseFavorites_ExerciseId",
                table: "ExerciseFavorites",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseMedia_ExerciseId_SortOrder",
                table: "ExerciseMedia",
                columns: new[] { "ExerciseId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseMedia_StoredFileId",
                table: "ExerciseMedia",
                column: "StoredFileId");

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseMuscles_MuscleGroupId",
                table: "ExerciseMuscles",
                column: "MuscleGroupId");

            migrationBuilder.CreateIndex(
                name: "UX_ExerciseMuscles_OnePrimary",
                table: "ExerciseMuscles",
                column: "ExerciseId",
                unique: true,
                filter: "[Role] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_IsActive",
                table: "Exercises",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_MovementPatternId",
                table: "Exercises",
                column: "MovementPatternId");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_NameEn",
                table: "Exercises",
                column: "NameEn",
                unique: true,
                filter: "[NameEn] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Exercises_NameEs",
                table: "Exercises",
                column: "NameEs",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExerciseVariants_VariantExerciseId",
                table: "ExerciseVariants",
                column: "VariantExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_ClientId_MeasurementTypeId_MeasuredOn",
                table: "Measurements",
                columns: new[] { "ClientId", "MeasurementTypeId", "MeasuredOn" });

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_EvaluationId",
                table: "Measurements",
                column: "EvaluationId");

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_MeasurementTypeId",
                table: "Measurements",
                column: "MeasurementTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_RecordedByUserId",
                table: "Measurements",
                column: "RecordedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MeasurementTypes_NameEn",
                table: "MeasurementTypes",
                column: "NameEn",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeasurementTypes_NameEs",
                table: "MeasurementTypes",
                column: "NameEs",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MovementPatterns_NameEn",
                table: "MovementPatterns",
                column: "NameEn",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MovementPatterns_NameEs",
                table: "MovementPatterns",
                column: "NameEs",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MuscleGroups_NameEn",
                table: "MuscleGroups",
                column: "NameEn",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MuscleGroups_NameEs",
                table: "MuscleGroups",
                column: "NameEs",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgressPhotos_ClientId_TakenOn",
                table: "ProgressPhotos",
                columns: new[] { "ClientId", "TakenOn" });

            migrationBuilder.CreateIndex(
                name: "IX_ProgressPhotos_EvaluationId",
                table: "ProgressPhotos",
                column: "EvaluationId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgressPhotos_StoredFileId",
                table: "ProgressPhotos",
                column: "StoredFileId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoutineAssignments_AssignedByUserId",
                table: "RoutineAssignments",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RoutineAssignments_ClientId_Status_StartDate",
                table: "RoutineAssignments",
                columns: new[] { "ClientId", "Status", "StartDate" });

            migrationBuilder.CreateIndex(
                name: "IX_RoutineAssignments_RoutineVersionId",
                table: "RoutineAssignments",
                column: "RoutineVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_RoutineDays_RoutineVersionId_Position",
                table: "RoutineDays",
                columns: new[] { "RoutineVersionId", "Position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoutineExercises_ExerciseId",
                table: "RoutineExercises",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_RoutineExercises_RoutineDayId_Position",
                table: "RoutineExercises",
                columns: new[] { "RoutineDayId", "Position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoutineExerciseSets_RoutineExerciseId_SetNumber",
                table: "RoutineExerciseSets",
                columns: new[] { "RoutineExerciseId", "SetNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Routines_TrainerId_Kind_Status",
                table: "Routines",
                columns: new[] { "TrainerId", "Kind", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_RoutineVersions_PublishedByUserId",
                table: "RoutineVersions",
                column: "PublishedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RoutineVersions_RoutineId_VersionNumber",
                table: "RoutineVersions",
                columns: new[] { "RoutineId", "VersionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RoutineVersions_SourceVersionId",
                table: "RoutineVersions",
                column: "SourceVersionId");

            migrationBuilder.CreateIndex(
                name: "UX_RoutineVersions_OneDraft",
                table: "RoutineVersions",
                column: "RoutineId",
                unique: true,
                filter: "[Status] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_StoredFiles_OwnerClientId",
                table: "StoredFiles",
                column: "OwnerClientId");

            migrationBuilder.CreateIndex(
                name: "IX_StoredFiles_StorageProvider_StorageKey",
                table: "StoredFiles",
                columns: new[] { "StorageProvider", "StorageKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StoredFiles_UploadedByUserId",
                table: "StoredFiles",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingLogExercises_ExerciseId",
                table: "TrainingLogExercises",
                column: "ExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingLogExercises_RoutineExerciseId",
                table: "TrainingLogExercises",
                column: "RoutineExerciseId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingLogExercises_TrainingLogId_Position",
                table: "TrainingLogExercises",
                columns: new[] { "TrainingLogId", "Position" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TrainingLogs_ClientId_StartedAt",
                table: "TrainingLogs",
                columns: new[] { "ClientId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TrainingLogs_RoutineAssignmentId",
                table: "TrainingLogs",
                column: "RoutineAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingLogs_RoutineDayId",
                table: "TrainingLogs",
                column: "RoutineDayId");

            migrationBuilder.CreateIndex(
                name: "UX_TrainingLogs_OneInProgress",
                table: "TrainingLogs",
                column: "ClientId",
                unique: true,
                filter: "[Status] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingLogSets_TrainingLogExerciseId_SetNumber",
                table: "TrainingLogSets",
                columns: new[] { "TrainingLogExerciseId", "SetNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserRoles");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "CalendarEvents");

            migrationBuilder.DropTable(
                name: "ClientNotes");

            migrationBuilder.DropTable(
                name: "ExerciseEquipment");

            migrationBuilder.DropTable(
                name: "ExerciseFavorites");

            migrationBuilder.DropTable(
                name: "ExerciseMedia");

            migrationBuilder.DropTable(
                name: "ExerciseMuscles");

            migrationBuilder.DropTable(
                name: "ExerciseVariants");

            migrationBuilder.DropTable(
                name: "Measurements");

            migrationBuilder.DropTable(
                name: "ProgressPhotos");

            migrationBuilder.DropTable(
                name: "RoutineExerciseSets");

            migrationBuilder.DropTable(
                name: "TrainingLogSets");

            migrationBuilder.DropTable(
                name: "AspNetRoles");

            migrationBuilder.DropTable(
                name: "Equipment");

            migrationBuilder.DropTable(
                name: "MuscleGroups");

            migrationBuilder.DropTable(
                name: "MeasurementTypes");

            migrationBuilder.DropTable(
                name: "Evaluations");

            migrationBuilder.DropTable(
                name: "StoredFiles");

            migrationBuilder.DropTable(
                name: "TrainingLogExercises");

            migrationBuilder.DropTable(
                name: "RoutineExercises");

            migrationBuilder.DropTable(
                name: "TrainingLogs");

            migrationBuilder.DropTable(
                name: "Exercises");

            migrationBuilder.DropTable(
                name: "RoutineAssignments");

            migrationBuilder.DropTable(
                name: "RoutineDays");

            migrationBuilder.DropTable(
                name: "MovementPatterns");

            migrationBuilder.DropTable(
                name: "Clients");

            migrationBuilder.DropTable(
                name: "RoutineVersions");

            migrationBuilder.DropTable(
                name: "Routines");

            migrationBuilder.DropTable(
                name: "AspNetUsers");
        }
    }
}
