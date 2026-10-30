IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetRoles] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(256) NULL,
        [NormalizedName] nvarchar(256) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoles] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUsers] (
        [Id] int NOT NULL IDENTITY,
        [DisplayName] nvarchar(150) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        [UserName] nvarchar(256) NULL,
        [NormalizedUserName] nvarchar(256) NULL,
        [Email] nvarchar(256) NULL,
        [NormalizedEmail] nvarchar(256) NULL,
        [EmailConfirmed] bit NOT NULL,
        [PasswordHash] nvarchar(max) NULL,
        [SecurityStamp] nvarchar(max) NULL,
        [ConcurrencyStamp] nvarchar(max) NULL,
        [PhoneNumber] nvarchar(max) NULL,
        [PhoneNumberConfirmed] bit NOT NULL,
        [TwoFactorEnabled] bit NOT NULL,
        [LockoutEnd] datetimeoffset NULL,
        [LockoutEnabled] bit NOT NULL,
        [AccessFailedCount] int NOT NULL,
        CONSTRAINT [PK_AspNetUsers] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [AuditLogs] (
        [Id] bigint NOT NULL IDENTITY,
        [OccurredAt] datetime2 NOT NULL DEFAULT (SYSUTCDATETIME()),
        [UserId] int NULL,
        [Action] nvarchar(100) NOT NULL,
        [EntityType] nvarchar(100) NOT NULL,
        [EntityId] nvarchar(64) NULL,
        [Details] nvarchar(4000) NULL,
        [IpAddress] nvarchar(45) NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [Equipment] (
        [Id] int NOT NULL IDENTITY,
        [NameEs] nvarchar(100) NOT NULL,
        [NameEn] nvarchar(100) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Equipment] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [MeasurementTypes] (
        [Id] int NOT NULL IDENTITY,
        [NameEs] nvarchar(100) NOT NULL,
        [NameEn] nvarchar(100) NOT NULL,
        [Kind] int NOT NULL,
        [Unit] nvarchar(10) NOT NULL,
        [SortOrder] int NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_MeasurementTypes] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [MovementPatterns] (
        [Id] int NOT NULL IDENTITY,
        [NameEs] nvarchar(100) NOT NULL,
        [NameEn] nvarchar(100) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_MovementPatterns] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [MuscleGroups] (
        [Id] int NOT NULL IDENTITY,
        [NameEs] nvarchar(100) NOT NULL,
        [NameEn] nvarchar(100) NOT NULL,
        [SortOrder] int NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_MuscleGroups] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetRoleClaims] (
        [Id] int NOT NULL IDENTITY,
        [RoleId] int NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetRoleClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetRoleClaims_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUserClaims] (
        [Id] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [ClaimType] nvarchar(max) NULL,
        [ClaimValue] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserClaims] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AspNetUserClaims_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUserLogins] (
        [LoginProvider] nvarchar(450) NOT NULL,
        [ProviderKey] nvarchar(450) NOT NULL,
        [ProviderDisplayName] nvarchar(max) NULL,
        [UserId] int NOT NULL,
        CONSTRAINT [PK_AspNetUserLogins] PRIMARY KEY ([LoginProvider], [ProviderKey]),
        CONSTRAINT [FK_AspNetUserLogins_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUserRoles] (
        [UserId] int NOT NULL,
        [RoleId] int NOT NULL,
        CONSTRAINT [PK_AspNetUserRoles] PRIMARY KEY ([UserId], [RoleId]),
        CONSTRAINT [FK_AspNetUserRoles_AspNetRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AspNetRoles] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AspNetUserRoles_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [AspNetUserTokens] (
        [UserId] int NOT NULL,
        [LoginProvider] nvarchar(450) NOT NULL,
        [Name] nvarchar(450) NOT NULL,
        [Value] nvarchar(max) NULL,
        CONSTRAINT [PK_AspNetUserTokens] PRIMARY KEY ([UserId], [LoginProvider], [Name]),
        CONSTRAINT [FK_AspNetUserTokens_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [Clients] (
        [Id] int NOT NULL IDENTITY,
        [TrainerId] int NOT NULL,
        [UserId] int NULL,
        [FirstName] nvarchar(100) NOT NULL,
        [LastName] nvarchar(100) NOT NULL,
        [Email] nvarchar(256) NOT NULL,
        [Phone] nvarchar(30) NULL,
        [BirthDate] date NULL,
        [Height] decimal(5,2) NULL,
        [HeightUnit] int NULL,
        [Weight] decimal(6,2) NULL,
        [WeightUnit] int NULL,
        [ExperienceLevel] int NULL,
        [Goal] nvarchar(500) NULL,
        [TrainingLocation] int NULL,
        [AvailableDays] int NOT NULL,
        [SessionDurationMinutes] int NULL,
        [DeclaredLimitations] nvarchar(2000) NULL,
        [Status] int NOT NULL,
        [DeactivatedAt] datetime2 NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Clients] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_Clients_Height] CHECK ([Height] IS NULL OR ([Height] > 0 AND [HeightUnit] IS NOT NULL)),
        CONSTRAINT [CK_Clients_SessionDuration] CHECK ([SessionDurationMinutes] IS NULL OR [SessionDurationMinutes] > 0),
        CONSTRAINT [CK_Clients_Weight] CHECK ([Weight] IS NULL OR ([Weight] > 0 AND [WeightUnit] IS NOT NULL)),
        CONSTRAINT [FK_Clients_AspNetUsers_TrainerId] FOREIGN KEY ([TrainerId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Clients_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [Routines] (
        [Id] int NOT NULL IDENTITY,
        [TrainerId] int NOT NULL,
        [Kind] int NOT NULL,
        [Name] nvarchar(150) NOT NULL,
        [Status] int NOT NULL,
        [ArchivedAt] datetime2 NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Routines] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Routines_AspNetUsers_TrainerId] FOREIGN KEY ([TrainerId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [Exercises] (
        [Id] int NOT NULL IDENTITY,
        [NameEs] nvarchar(150) NOT NULL,
        [NameEn] nvarchar(150) NULL,
        [Description] nvarchar(2000) NULL,
        [Instructions] nvarchar(4000) NULL,
        [CommonMistakes] nvarchar(2000) NULL,
        [TechnicalTips] nvarchar(2000) NULL,
        [Type] int NOT NULL,
        [Difficulty] int NULL,
        [MovementPatternId] int NULL,
        [IsActive] bit NOT NULL,
        [DeactivatedAt] datetime2 NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Exercises] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Exercises_MovementPatterns_MovementPatternId] FOREIGN KEY ([MovementPatternId]) REFERENCES [MovementPatterns] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [ClientNotes] (
        [Id] int NOT NULL IDENTITY,
        [ClientId] int NOT NULL,
        [AuthorUserId] int NOT NULL,
        [Content] nvarchar(4000) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ClientNotes] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ClientNotes_AspNetUsers_AuthorUserId] FOREIGN KEY ([AuthorUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ClientNotes_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [Evaluations] (
        [Id] int NOT NULL IDENTITY,
        [ClientId] int NOT NULL,
        [EvaluatedOn] date NOT NULL,
        [PerformedByUserId] int NOT NULL,
        [Notes] nvarchar(2000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Evaluations] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Evaluations_AspNetUsers_PerformedByUserId] FOREIGN KEY ([PerformedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Evaluations_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [StoredFiles] (
        [Id] uniqueidentifier NOT NULL,
        [Purpose] int NOT NULL,
        [OwnerClientId] int NULL,
        [UploadedByUserId] int NOT NULL,
        [OriginalFileName] nvarchar(255) NOT NULL,
        [ContentType] nvarchar(100) NOT NULL,
        [SizeBytes] bigint NOT NULL,
        [Sha256] nchar(64) NULL,
        [StorageProvider] nvarchar(30) NOT NULL,
        [StorageKey] nvarchar(500) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [DeletedAt] datetime2 NULL,
        CONSTRAINT [PK_StoredFiles] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_StoredFiles_Size] CHECK ([SizeBytes] > 0),
        CONSTRAINT [FK_StoredFiles_AspNetUsers_UploadedByUserId] FOREIGN KEY ([UploadedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_StoredFiles_Clients_OwnerClientId] FOREIGN KEY ([OwnerClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [RoutineVersions] (
        [Id] int NOT NULL IDENTITY,
        [RoutineId] int NOT NULL,
        [VersionNumber] int NOT NULL,
        [Status] int NOT NULL,
        [Title] nvarchar(150) NOT NULL,
        [Description] nvarchar(2000) NULL,
        [Goal] nvarchar(500) NULL,
        [DurationWeeks] int NULL,
        [ChangeNotes] nvarchar(1000) NULL,
        [SourceVersionId] int NULL,
        [PublishedAt] datetime2 NULL,
        [PublishedByUserId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_RoutineVersions] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_RoutineVersions_Duration] CHECK ([DurationWeeks] IS NULL OR [DurationWeeks] > 0),
        CONSTRAINT [CK_RoutineVersions_Published] CHECK ([Status] <> 2 OR [PublishedAt] IS NOT NULL),
        CONSTRAINT [CK_RoutineVersions_VersionNumber] CHECK ([VersionNumber] >= 1),
        CONSTRAINT [FK_RoutineVersions_AspNetUsers_PublishedByUserId] FOREIGN KEY ([PublishedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RoutineVersions_RoutineVersions_SourceVersionId] FOREIGN KEY ([SourceVersionId]) REFERENCES [RoutineVersions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RoutineVersions_Routines_RoutineId] FOREIGN KEY ([RoutineId]) REFERENCES [Routines] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [ExerciseEquipment] (
        [ExerciseId] int NOT NULL,
        [EquipmentId] int NOT NULL,
        CONSTRAINT [PK_ExerciseEquipment] PRIMARY KEY ([ExerciseId], [EquipmentId]),
        CONSTRAINT [FK_ExerciseEquipment_Equipment_EquipmentId] FOREIGN KEY ([EquipmentId]) REFERENCES [Equipment] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ExerciseEquipment_Exercises_ExerciseId] FOREIGN KEY ([ExerciseId]) REFERENCES [Exercises] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [ExerciseFavorites] (
        [UserId] int NOT NULL,
        [ExerciseId] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ExerciseFavorites] PRIMARY KEY ([UserId], [ExerciseId]),
        CONSTRAINT [FK_ExerciseFavorites_AspNetUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ExerciseFavorites_Exercises_ExerciseId] FOREIGN KEY ([ExerciseId]) REFERENCES [Exercises] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [ExerciseMuscles] (
        [ExerciseId] int NOT NULL,
        [MuscleGroupId] int NOT NULL,
        [Role] int NOT NULL,
        CONSTRAINT [PK_ExerciseMuscles] PRIMARY KEY ([ExerciseId], [MuscleGroupId]),
        CONSTRAINT [FK_ExerciseMuscles_Exercises_ExerciseId] FOREIGN KEY ([ExerciseId]) REFERENCES [Exercises] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ExerciseMuscles_MuscleGroups_MuscleGroupId] FOREIGN KEY ([MuscleGroupId]) REFERENCES [MuscleGroups] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [ExerciseVariants] (
        [ExerciseId] int NOT NULL,
        [VariantExerciseId] int NOT NULL,
        [Note] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ExerciseVariants] PRIMARY KEY ([ExerciseId], [VariantExerciseId]),
        CONSTRAINT [CK_ExerciseVariants_NotSelf] CHECK ([ExerciseId] <> [VariantExerciseId]),
        CONSTRAINT [FK_ExerciseVariants_Exercises_ExerciseId] FOREIGN KEY ([ExerciseId]) REFERENCES [Exercises] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ExerciseVariants_Exercises_VariantExerciseId] FOREIGN KEY ([VariantExerciseId]) REFERENCES [Exercises] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [Measurements] (
        [Id] int NOT NULL IDENTITY,
        [ClientId] int NOT NULL,
        [MeasurementTypeId] int NOT NULL,
        [EvaluationId] int NULL,
        [MeasuredOn] date NOT NULL,
        [Value] decimal(8,2) NOT NULL,
        [Unit] nvarchar(10) NOT NULL,
        [RecordedByUserId] int NOT NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Measurements] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_Measurements_Value] CHECK ([Value] > 0),
        CONSTRAINT [FK_Measurements_AspNetUsers_RecordedByUserId] FOREIGN KEY ([RecordedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Measurements_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Measurements_Evaluations_EvaluationId] FOREIGN KEY ([EvaluationId]) REFERENCES [Evaluations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Measurements_MeasurementTypes_MeasurementTypeId] FOREIGN KEY ([MeasurementTypeId]) REFERENCES [MeasurementTypes] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [ExerciseMedia] (
        [Id] int NOT NULL IDENTITY,
        [ExerciseId] int NOT NULL,
        [MediaType] int NOT NULL,
        [StoredFileId] uniqueidentifier NULL,
        [ExternalUrl] nvarchar(1000) NULL,
        [Title] nvarchar(150) NULL,
        [SortOrder] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ExerciseMedia] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ExerciseMedia_OneSource] CHECK (([StoredFileId] IS NOT NULL AND [ExternalUrl] IS NULL) OR ([StoredFileId] IS NULL AND [ExternalUrl] IS NOT NULL)),
        CONSTRAINT [FK_ExerciseMedia_Exercises_ExerciseId] FOREIGN KEY ([ExerciseId]) REFERENCES [Exercises] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ExerciseMedia_StoredFiles_StoredFileId] FOREIGN KEY ([StoredFileId]) REFERENCES [StoredFiles] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [ProgressPhotos] (
        [Id] int NOT NULL IDENTITY,
        [ClientId] int NOT NULL,
        [StoredFileId] uniqueidentifier NOT NULL,
        [EvaluationId] int NULL,
        [TakenOn] date NOT NULL,
        [Category] int NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ProgressPhotos] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgressPhotos_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ProgressPhotos_Evaluations_EvaluationId] FOREIGN KEY ([EvaluationId]) REFERENCES [Evaluations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ProgressPhotos_StoredFiles_StoredFileId] FOREIGN KEY ([StoredFileId]) REFERENCES [StoredFiles] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [RoutineAssignments] (
        [Id] int NOT NULL IDENTITY,
        [ClientId] int NOT NULL,
        [RoutineVersionId] int NOT NULL,
        [AssignedByUserId] int NOT NULL,
        [StartDate] date NOT NULL,
        [EndDate] date NULL,
        [Status] int NOT NULL,
        [StatusChangedAt] datetime2 NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_RoutineAssignments] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_RoutineAssignments_Dates] CHECK ([EndDate] IS NULL OR [EndDate] >= [StartDate]),
        CONSTRAINT [FK_RoutineAssignments_AspNetUsers_AssignedByUserId] FOREIGN KEY ([AssignedByUserId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RoutineAssignments_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RoutineAssignments_RoutineVersions_RoutineVersionId] FOREIGN KEY ([RoutineVersionId]) REFERENCES [RoutineVersions] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [RoutineDays] (
        [Id] int NOT NULL IDENTITY,
        [RoutineVersionId] int NOT NULL,
        [Position] int NOT NULL,
        [Name] nvarchar(100) NOT NULL,
        [DayOfWeek] int NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_RoutineDays] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RoutineDays_RoutineVersions_RoutineVersionId] FOREIGN KEY ([RoutineVersionId]) REFERENCES [RoutineVersions] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [RoutineExercises] (
        [Id] int NOT NULL IDENTITY,
        [RoutineDayId] int NOT NULL,
        [ExerciseId] int NOT NULL,
        [Position] int NOT NULL,
        [SupersetGroup] nvarchar(10) NULL,
        [Sets] int NOT NULL,
        [RepsMin] int NULL,
        [RepsMax] int NULL,
        [SuggestedWeight] decimal(7,2) NULL,
        [SuggestedWeightUnit] int NULL,
        [RestSeconds] int NULL,
        [Tempo] nvarchar(20) NULL,
        [Rir] decimal(3,1) NULL,
        [Rpe] decimal(3,1) NULL,
        [SetType] int NOT NULL,
        [Notes] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_RoutineExercises] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_RoutineExercises_Reps] CHECK (([RepsMin] IS NULL OR [RepsMin] >= 0) AND ([RepsMax] IS NULL OR [RepsMax] >= 0) AND ([RepsMin] IS NULL OR [RepsMax] IS NULL OR [RepsMin] <= [RepsMax])),
        CONSTRAINT [CK_RoutineExercises_Rest] CHECK ([RestSeconds] IS NULL OR [RestSeconds] >= 0),
        CONSTRAINT [CK_RoutineExercises_Rir] CHECK ([Rir] IS NULL OR ([Rir] >= 0 AND [Rir] <= 10)),
        CONSTRAINT [CK_RoutineExercises_Rpe] CHECK ([Rpe] IS NULL OR ([Rpe] >= 1 AND [Rpe] <= 10)),
        CONSTRAINT [CK_RoutineExercises_Sets] CHECK ([Sets] >= 1),
        CONSTRAINT [CK_RoutineExercises_Weight] CHECK ([SuggestedWeight] IS NULL OR ([SuggestedWeight] >= 0 AND [SuggestedWeightUnit] IS NOT NULL)),
        CONSTRAINT [FK_RoutineExercises_Exercises_ExerciseId] FOREIGN KEY ([ExerciseId]) REFERENCES [Exercises] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_RoutineExercises_RoutineDays_RoutineDayId] FOREIGN KEY ([RoutineDayId]) REFERENCES [RoutineDays] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [TrainingLogs] (
        [Id] int NOT NULL IDENTITY,
        [ClientId] int NOT NULL,
        [RoutineAssignmentId] int NULL,
        [RoutineDayId] int NULL,
        [RoutineTitle] nvarchar(150) NULL,
        [RoutineVersionNumber] int NULL,
        [DayName] nvarchar(100) NULL,
        [Status] int NOT NULL,
        [StartedAt] datetime2 NOT NULL,
        [CompletedAt] datetime2 NULL,
        [Comment] nvarchar(2000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TrainingLogs] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_TrainingLogs_Completed] CHECK ([Status] <> 2 OR [CompletedAt] IS NOT NULL),
        CONSTRAINT [CK_TrainingLogs_Dates] CHECK ([CompletedAt] IS NULL OR [CompletedAt] >= [StartedAt]),
        CONSTRAINT [FK_TrainingLogs_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TrainingLogs_RoutineAssignments_RoutineAssignmentId] FOREIGN KEY ([RoutineAssignmentId]) REFERENCES [RoutineAssignments] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TrainingLogs_RoutineDays_RoutineDayId] FOREIGN KEY ([RoutineDayId]) REFERENCES [RoutineDays] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [RoutineExerciseSets] (
        [Id] int NOT NULL IDENTITY,
        [RoutineExerciseId] int NOT NULL,
        [SetNumber] int NOT NULL,
        [SetType] int NOT NULL,
        [RepsMin] int NULL,
        [RepsMax] int NULL,
        [SuggestedWeight] decimal(7,2) NULL,
        [SuggestedWeightUnit] int NULL,
        [RestSeconds] int NULL,
        [Rir] decimal(3,1) NULL,
        [Rpe] decimal(3,1) NULL,
        [Notes] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_RoutineExerciseSets] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_RoutineExerciseSets_Reps] CHECK (([RepsMin] IS NULL OR [RepsMin] >= 0) AND ([RepsMax] IS NULL OR [RepsMax] >= 0) AND ([RepsMin] IS NULL OR [RepsMax] IS NULL OR [RepsMin] <= [RepsMax])),
        CONSTRAINT [CK_RoutineExerciseSets_Rest] CHECK ([RestSeconds] IS NULL OR [RestSeconds] >= 0),
        CONSTRAINT [CK_RoutineExerciseSets_Rir] CHECK ([Rir] IS NULL OR ([Rir] >= 0 AND [Rir] <= 10)),
        CONSTRAINT [CK_RoutineExerciseSets_Rpe] CHECK ([Rpe] IS NULL OR ([Rpe] >= 1 AND [Rpe] <= 10)),
        CONSTRAINT [CK_RoutineExerciseSets_SetNumber] CHECK ([SetNumber] >= 1),
        CONSTRAINT [CK_RoutineExerciseSets_Weight] CHECK ([SuggestedWeight] IS NULL OR ([SuggestedWeight] >= 0 AND [SuggestedWeightUnit] IS NOT NULL)),
        CONSTRAINT [FK_RoutineExerciseSets_RoutineExercises_RoutineExerciseId] FOREIGN KEY ([RoutineExerciseId]) REFERENCES [RoutineExercises] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [CalendarEvents] (
        [Id] int NOT NULL IDENTITY,
        [TrainerId] int NOT NULL,
        [ClientId] int NULL,
        [Type] int NOT NULL,
        [Status] int NOT NULL,
        [Title] nvarchar(150) NOT NULL,
        [Date] date NOT NULL,
        [StartTime] time NULL,
        [EndTime] time NULL,
        [Notes] nvarchar(1000) NULL,
        [RoutineAssignmentId] int NULL,
        [RoutineDayId] int NULL,
        [TrainingLogId] int NULL,
        [EvaluationId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_CalendarEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_CalendarEvents_Times] CHECK ([EndTime] IS NULL OR ([StartTime] IS NOT NULL AND [EndTime] >= [StartTime])),
        CONSTRAINT [FK_CalendarEvents_AspNetUsers_TrainerId] FOREIGN KEY ([TrainerId]) REFERENCES [AspNetUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CalendarEvents_Clients_ClientId] FOREIGN KEY ([ClientId]) REFERENCES [Clients] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CalendarEvents_Evaluations_EvaluationId] FOREIGN KEY ([EvaluationId]) REFERENCES [Evaluations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CalendarEvents_RoutineAssignments_RoutineAssignmentId] FOREIGN KEY ([RoutineAssignmentId]) REFERENCES [RoutineAssignments] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CalendarEvents_RoutineDays_RoutineDayId] FOREIGN KEY ([RoutineDayId]) REFERENCES [RoutineDays] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_CalendarEvents_TrainingLogs_TrainingLogId] FOREIGN KEY ([TrainingLogId]) REFERENCES [TrainingLogs] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [TrainingLogExercises] (
        [Id] int NOT NULL IDENTITY,
        [TrainingLogId] int NOT NULL,
        [ExerciseId] int NOT NULL,
        [RoutineExerciseId] int NULL,
        [Position] int NOT NULL,
        [ExerciseNameEs] nvarchar(150) NOT NULL,
        [ExerciseNameEn] nvarchar(150) NULL,
        [SupersetGroup] nvarchar(10) NULL,
        [PrescribedSets] int NULL,
        [PrescribedRepsMin] int NULL,
        [PrescribedRepsMax] int NULL,
        [PrescribedWeight] decimal(7,2) NULL,
        [PrescribedWeightUnit] int NULL,
        [PrescribedRestSeconds] int NULL,
        [PrescribedTempo] nvarchar(20) NULL,
        [PrescribedRir] decimal(3,1) NULL,
        [PrescribedRpe] decimal(3,1) NULL,
        [PrescribedNotes] nvarchar(1000) NULL,
        [IsCompleted] bit NOT NULL,
        [Comment] nvarchar(1000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TrainingLogExercises] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_TrainingLogExercises_Exercises_ExerciseId] FOREIGN KEY ([ExerciseId]) REFERENCES [Exercises] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TrainingLogExercises_RoutineExercises_RoutineExerciseId] FOREIGN KEY ([RoutineExerciseId]) REFERENCES [RoutineExercises] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TrainingLogExercises_TrainingLogs_TrainingLogId] FOREIGN KEY ([TrainingLogId]) REFERENCES [TrainingLogs] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE TABLE [TrainingLogSets] (
        [Id] int NOT NULL IDENTITY,
        [TrainingLogExerciseId] int NOT NULL,
        [SetNumber] int NOT NULL,
        [SetType] int NOT NULL,
        [Reps] int NULL,
        [Weight] decimal(7,2) NULL,
        [WeightUnit] int NULL,
        [Rir] decimal(3,1) NULL,
        [Rpe] decimal(3,1) NULL,
        [IsCompleted] bit NOT NULL,
        [Notes] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TrainingLogSets] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_TrainingLogSets_Reps] CHECK ([Reps] IS NULL OR [Reps] >= 0),
        CONSTRAINT [CK_TrainingLogSets_Rir] CHECK ([Rir] IS NULL OR ([Rir] >= 0 AND [Rir] <= 10)),
        CONSTRAINT [CK_TrainingLogSets_Rpe] CHECK ([Rpe] IS NULL OR ([Rpe] >= 1 AND [Rpe] <= 10)),
        CONSTRAINT [CK_TrainingLogSets_SetNumber] CHECK ([SetNumber] >= 1),
        CONSTRAINT [CK_TrainingLogSets_Weight] CHECK ([Weight] IS NULL OR ([Weight] >= 0 AND [WeightUnit] IS NOT NULL)),
        CONSTRAINT [FK_TrainingLogSets_TrainingLogExercises_TrainingLogExerciseId] FOREIGN KEY ([TrainingLogExerciseId]) REFERENCES [TrainingLogExercises] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'ConcurrencyStamp', N'Name', N'NormalizedName') AND [object_id] = OBJECT_ID(N'[AspNetRoles]'))
        SET IDENTITY_INSERT [AspNetRoles] ON;
    EXEC(N'INSERT INTO [AspNetRoles] ([Id], [ConcurrencyStamp], [Name], [NormalizedName])
    VALUES (1, N''b6d1f0c2-5a2e-4f7e-9d3a-000000000001'', N''TRAINER'', N''TRAINER''),
    (2, N''b6d1f0c2-5a2e-4f7e-9d3a-000000000002'', N''CLIENT'', N''CLIENT'')');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'ConcurrencyStamp', N'Name', N'NormalizedName') AND [object_id] = OBJECT_ID(N'[AspNetRoles]'))
        SET IDENTITY_INSERT [AspNetRoles] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'CreatedAt', N'IsActive', N'Kind', N'NameEn', N'NameEs', N'SortOrder', N'Unit', N'UpdatedAt') AND [object_id] = OBJECT_ID(N'[MeasurementTypes]'))
        SET IDENTITY_INSERT [MeasurementTypes] ON;
    EXEC(N'INSERT INTO [MeasurementTypes] ([Id], [CreatedAt], [IsActive], [Kind], [NameEn], [NameEs], [SortOrder], [Unit], [UpdatedAt])
    VALUES (1, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), 1, N''Body weight'', N''Peso corporal'', 1, N''kg'', ''2026-10-30T00:00:00.0000000Z''),
    (2, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), 2, N''Waist'', N''Cintura'', 2, N''cm'', ''2026-10-30T00:00:00.0000000Z''),
    (3, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), 2, N''Hips'', N''Cadera'', 3, N''cm'', ''2026-10-30T00:00:00.0000000Z''),
    (4, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), 2, N''Glutes'', N''Glúteos'', 4, N''cm'', ''2026-10-30T00:00:00.0000000Z''),
    (5, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), 2, N''Thigh'', N''Muslo'', 5, N''cm'', ''2026-10-30T00:00:00.0000000Z''),
    (6, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), 2, N''Arm'', N''Brazo'', 6, N''cm'', ''2026-10-30T00:00:00.0000000Z''),
    (7, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), 2, N''Calf'', N''Pantorrilla'', 7, N''cm'', ''2026-10-30T00:00:00.0000000Z'')');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'CreatedAt', N'IsActive', N'Kind', N'NameEn', N'NameEs', N'SortOrder', N'Unit', N'UpdatedAt') AND [object_id] = OBJECT_ID(N'[MeasurementTypes]'))
        SET IDENTITY_INSERT [MeasurementTypes] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'CreatedAt', N'IsActive', N'NameEn', N'NameEs', N'SortOrder', N'UpdatedAt') AND [object_id] = OBJECT_ID(N'[MuscleGroups]'))
        SET IDENTITY_INSERT [MuscleGroups] ON;
    EXEC(N'INSERT INTO [MuscleGroups] ([Id], [CreatedAt], [IsActive], [NameEn], [NameEs], [SortOrder], [UpdatedAt])
    VALUES (1, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Glutes'', N''Glúteos'', 1, ''2026-10-30T00:00:00.0000000Z''),
    (2, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Hamstrings'', N''Femoral'', 2, ''2026-10-30T00:00:00.0000000Z''),
    (3, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Quadriceps'', N''Cuádriceps'', 3, ''2026-10-30T00:00:00.0000000Z''),
    (4, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Abductors'', N''Abductores'', 4, ''2026-10-30T00:00:00.0000000Z''),
    (5, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Adductors'', N''Aductores'', 5, ''2026-10-30T00:00:00.0000000Z''),
    (6, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Calves'', N''Pantorrillas'', 6, ''2026-10-30T00:00:00.0000000Z''),
    (7, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Back'', N''Espalda'', 7, ''2026-10-30T00:00:00.0000000Z''),
    (8, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Chest'', N''Pecho'', 8, ''2026-10-30T00:00:00.0000000Z''),
    (9, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Shoulders'', N''Hombros'', 9, ''2026-10-30T00:00:00.0000000Z''),
    (10, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Biceps'', N''Bíceps'', 10, ''2026-10-30T00:00:00.0000000Z''),
    (11, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Triceps'', N''Tríceps'', 11, ''2026-10-30T00:00:00.0000000Z''),
    (12, ''2026-10-30T00:00:00.0000000Z'', CAST(1 AS bit), N''Abs'', N''Abdomen'', 12, ''2026-10-30T00:00:00.0000000Z'')');
    IF EXISTS (SELECT * FROM [sys].[identity_columns] WHERE [name] IN (N'Id', N'CreatedAt', N'IsActive', N'NameEn', N'NameEs', N'SortOrder', N'UpdatedAt') AND [object_id] = OBJECT_ID(N'[MuscleGroups]'))
        SET IDENTITY_INSERT [MuscleGroups] OFF;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetRoleClaims_RoleId] ON [AspNetRoleClaims] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [RoleNameIndex] ON [AspNetRoles] ([NormalizedName]) WHERE [NormalizedName] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetUserClaims_UserId] ON [AspNetUserClaims] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetUserLogins_UserId] ON [AspNetUserLogins] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AspNetUserRoles_RoleId] ON [AspNetUserRoles] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [EmailIndex] ON [AspNetUsers] ([NormalizedEmail]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [UserNameIndex] ON [AspNetUsers] ([NormalizedUserName]) WHERE [NormalizedUserName] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_EntityType_EntityId] ON [AuditLogs] ([EntityType], [EntityId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_OccurredAt] ON [AuditLogs] ([OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AuditLogs_UserId] ON [AuditLogs] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_CalendarEvents_ClientId_Date] ON [CalendarEvents] ([ClientId], [Date]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_CalendarEvents_EvaluationId] ON [CalendarEvents] ([EvaluationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_CalendarEvents_RoutineAssignmentId] ON [CalendarEvents] ([RoutineAssignmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_CalendarEvents_RoutineDayId] ON [CalendarEvents] ([RoutineDayId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_CalendarEvents_TrainerId_Date] ON [CalendarEvents] ([TrainerId], [Date]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_CalendarEvents_TrainingLogId] ON [CalendarEvents] ([TrainingLogId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ClientNotes_AuthorUserId] ON [ClientNotes] ([AuthorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ClientNotes_ClientId_CreatedAt] ON [ClientNotes] ([ClientId], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Clients_Email] ON [Clients] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Clients_TrainerId_Status] ON [Clients] ([TrainerId], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Clients_UserId] ON [Clients] ([UserId]) WHERE [UserId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Equipment_NameEn] ON [Equipment] ([NameEn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Equipment_NameEs] ON [Equipment] ([NameEs]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Evaluations_ClientId_EvaluatedOn] ON [Evaluations] ([ClientId], [EvaluatedOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Evaluations_PerformedByUserId] ON [Evaluations] ([PerformedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExerciseEquipment_EquipmentId] ON [ExerciseEquipment] ([EquipmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExerciseFavorites_ExerciseId] ON [ExerciseFavorites] ([ExerciseId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExerciseMedia_ExerciseId_SortOrder] ON [ExerciseMedia] ([ExerciseId], [SortOrder]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExerciseMedia_StoredFileId] ON [ExerciseMedia] ([StoredFileId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExerciseMuscles_MuscleGroupId] ON [ExerciseMuscles] ([MuscleGroupId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [UX_ExerciseMuscles_OnePrimary] ON [ExerciseMuscles] ([ExerciseId]) WHERE [Role] = 1');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Exercises_IsActive] ON [Exercises] ([IsActive]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Exercises_MovementPatternId] ON [Exercises] ([MovementPatternId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Exercises_NameEn] ON [Exercises] ([NameEn]) WHERE [NameEn] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Exercises_NameEs] ON [Exercises] ([NameEs]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExerciseVariants_VariantExerciseId] ON [ExerciseVariants] ([VariantExerciseId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Measurements_ClientId_MeasurementTypeId_MeasuredOn] ON [Measurements] ([ClientId], [MeasurementTypeId], [MeasuredOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Measurements_EvaluationId] ON [Measurements] ([EvaluationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Measurements_MeasurementTypeId] ON [Measurements] ([MeasurementTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Measurements_RecordedByUserId] ON [Measurements] ([RecordedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_MeasurementTypes_NameEn] ON [MeasurementTypes] ([NameEn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_MeasurementTypes_NameEs] ON [MeasurementTypes] ([NameEs]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_MovementPatterns_NameEn] ON [MovementPatterns] ([NameEn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_MovementPatterns_NameEs] ON [MovementPatterns] ([NameEs]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_MuscleGroups_NameEn] ON [MuscleGroups] ([NameEn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_MuscleGroups_NameEs] ON [MuscleGroups] ([NameEs]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ProgressPhotos_ClientId_TakenOn] ON [ProgressPhotos] ([ClientId], [TakenOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ProgressPhotos_EvaluationId] ON [ProgressPhotos] ([EvaluationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProgressPhotos_StoredFileId] ON [ProgressPhotos] ([StoredFileId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RoutineAssignments_AssignedByUserId] ON [RoutineAssignments] ([AssignedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RoutineAssignments_ClientId_Status_StartDate] ON [RoutineAssignments] ([ClientId], [Status], [StartDate]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RoutineAssignments_RoutineVersionId] ON [RoutineAssignments] ([RoutineVersionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RoutineDays_RoutineVersionId_Position] ON [RoutineDays] ([RoutineVersionId], [Position]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RoutineExercises_ExerciseId] ON [RoutineExercises] ([ExerciseId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RoutineExercises_RoutineDayId_Position] ON [RoutineExercises] ([RoutineDayId], [Position]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RoutineExerciseSets_RoutineExerciseId_SetNumber] ON [RoutineExerciseSets] ([RoutineExerciseId], [SetNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Routines_TrainerId_Kind_Status] ON [Routines] ([TrainerId], [Kind], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RoutineVersions_PublishedByUserId] ON [RoutineVersions] ([PublishedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RoutineVersions_RoutineId_VersionNumber] ON [RoutineVersions] ([RoutineId], [VersionNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RoutineVersions_SourceVersionId] ON [RoutineVersions] ([SourceVersionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [UX_RoutineVersions_OneDraft] ON [RoutineVersions] ([RoutineId]) WHERE [Status] = 1');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_StoredFiles_OwnerClientId] ON [StoredFiles] ([OwnerClientId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_StoredFiles_StorageProvider_StorageKey] ON [StoredFiles] ([StorageProvider], [StorageKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_StoredFiles_UploadedByUserId] ON [StoredFiles] ([UploadedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingLogExercises_ExerciseId] ON [TrainingLogExercises] ([ExerciseId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingLogExercises_RoutineExerciseId] ON [TrainingLogExercises] ([RoutineExerciseId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_TrainingLogExercises_TrainingLogId_Position] ON [TrainingLogExercises] ([TrainingLogId], [Position]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingLogs_ClientId_StartedAt] ON [TrainingLogs] ([ClientId], [StartedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingLogs_RoutineAssignmentId] ON [TrainingLogs] ([RoutineAssignmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingLogs_RoutineDayId] ON [TrainingLogs] ([RoutineDayId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [UX_TrainingLogs_OneInProgress] ON [TrainingLogs] ([ClientId]) WHERE [Status] = 1');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_TrainingLogSets_TrainingLogExerciseId_SetNumber] ON [TrainingLogSets] ([TrainingLogExerciseId], [SetNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261030170517_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261030170517_InitialCreate', N'10.0.14');
END;

COMMIT;
GO

