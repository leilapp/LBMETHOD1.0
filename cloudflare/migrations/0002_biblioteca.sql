-- Etapa 2: biblioteca de ejercicios (equivale a la Fase 5).
-- Cada nombre tiene su «clave» normalizada (minúsculas, sin acentos, espacios simples) para buscar y evitar
-- duplicados sin distinguir mayúsculas ni acentos, como hacía la intercalación de SQL Server.

CREATE TABLE muscle_groups (
  id          INTEGER PRIMARY KEY,
  name_es     TEXT    NOT NULL,
  name_en     TEXT    NOT NULL,
  name_es_key TEXT    NOT NULL UNIQUE,
  name_en_key TEXT    NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE equipment (
  id          INTEGER PRIMARY KEY,
  name_es     TEXT    NOT NULL,
  name_en     TEXT    NOT NULL,
  name_es_key TEXT    NOT NULL UNIQUE,
  name_en_key TEXT    NOT NULL UNIQUE,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE movement_patterns (
  id          INTEGER PRIMARY KEY,
  name_es     TEXT    NOT NULL,
  name_en     TEXT    NOT NULL,
  name_es_key TEXT    NOT NULL UNIQUE,
  name_en_key TEXT    NOT NULL UNIQUE,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

-- Catálogo central: cada ejercicio existe una vez y las rutinas lo reutilizan. Nunca se borra; se desactiva.
CREATE TABLE exercises (
  id                  INTEGER PRIMARY KEY,
  name_es             TEXT    NOT NULL,
  name_en             TEXT,
  name_es_key         TEXT    NOT NULL UNIQUE,
  name_en_key         TEXT,
  description         TEXT,
  instructions        TEXT,
  common_mistakes     TEXT,
  technical_tips      TEXT,
  type                INTEGER NOT NULL CHECK (type IN (1, 2, 3, 4, 5, 6, 99)),
  difficulty          INTEGER CHECK (difficulty IN (1, 2, 3)),
  movement_pattern_id INTEGER REFERENCES movement_patterns (id),
  is_active           INTEGER NOT NULL DEFAULT 1,
  deactivated_at      TEXT,
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);
CREATE UNIQUE INDEX ux_exercises_name_en_key ON exercises (name_en_key) WHERE name_en_key IS NOT NULL;

-- role: 1 = principal, 2 = secundario. Un solo músculo principal por ejercicio.
CREATE TABLE exercise_muscles (
  exercise_id     INTEGER NOT NULL REFERENCES exercises (id),
  muscle_group_id INTEGER NOT NULL REFERENCES muscle_groups (id),
  role            INTEGER NOT NULL CHECK (role IN (1, 2)),
  PRIMARY KEY (exercise_id, muscle_group_id)
) WITHOUT ROWID;
CREATE UNIQUE INDEX ux_exercise_muscles_one_primary ON exercise_muscles (exercise_id) WHERE role = 1;
CREATE INDEX ix_exercise_muscles_muscle ON exercise_muscles (muscle_group_id);

CREATE TABLE exercise_equipment (
  exercise_id  INTEGER NOT NULL REFERENCES exercises (id),
  equipment_id INTEGER NOT NULL REFERENCES equipment (id),
  PRIMARY KEY (exercise_id, equipment_id)
) WITHOUT ROWID;
CREATE INDEX ix_exercise_equipment_equipment ON exercise_equipment (equipment_id);

-- Cada variante es un ejercicio completo del catálogo; el vínculo se muestra en ambos sentidos.
CREATE TABLE exercise_variants (
  exercise_id         INTEGER NOT NULL REFERENCES exercises (id),
  variant_exercise_id INTEGER NOT NULL REFERENCES exercises (id),
  note                TEXT,
  created_at          TEXT    NOT NULL,
  PRIMARY KEY (exercise_id, variant_exercise_id),
  CHECK (exercise_id <> variant_exercise_id)
) WITHOUT ROWID;
CREATE INDEX ix_exercise_variants_variant ON exercise_variants (variant_exercise_id);

CREATE TABLE exercise_favorites (
  user_id     INTEGER NOT NULL REFERENCES users (id),
  exercise_id INTEGER NOT NULL REFERENCES exercises (id),
  created_at  TEXT    NOT NULL,
  PRIMARY KEY (user_id, exercise_id)
) WITHOUT ROWID;

-- Archivos privados en R2 (nombre aleatorio). Al quitar un medio, el archivo se borra de R2 y aquí queda la fecha.
CREATE TABLE stored_files (
  id                  TEXT    PRIMARY KEY,
  purpose             TEXT    NOT NULL,
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users (id),
  original_file_name  TEXT    NOT NULL,
  content_type        TEXT    NOT NULL,
  size_bytes          INTEGER NOT NULL,
  storage_key         TEXT    NOT NULL UNIQUE,
  created_at          TEXT    NOT NULL,
  deleted_at          TEXT
);

-- media_type: 1 = imagen, 2 = video. O un archivo privado o un enlace externo https, nunca ambos.
CREATE TABLE exercise_media (
  id             INTEGER PRIMARY KEY,
  exercise_id    INTEGER NOT NULL REFERENCES exercises (id),
  media_type     INTEGER NOT NULL CHECK (media_type IN (1, 2)),
  stored_file_id TEXT    REFERENCES stored_files (id),
  external_url   TEXT,
  title          TEXT,
  sort_order     INTEGER NOT NULL,
  CHECK ((stored_file_id IS NULL) <> (external_url IS NULL))
);
CREATE INDEX ix_exercise_media_exercise ON exercise_media (exercise_id, sort_order);

-- Catálogo inicial de la guía maestra (no son datos de ejemplo); la entrenadora puede editarlo.
INSERT INTO muscle_groups (id, name_es, name_en, name_es_key, name_en_key, sort_order, created_at, updated_at) VALUES
  (1, 'Glúteos', 'Glutes', 'gluteos', 'glutes', 1, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (2, 'Femoral', 'Hamstrings', 'femoral', 'hamstrings', 2, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (3, 'Cuádriceps', 'Quadriceps', 'cuadriceps', 'quadriceps', 3, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (4, 'Abductores', 'Abductors', 'abductores', 'abductors', 4, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (5, 'Aductores', 'Adductors', 'aductores', 'adductors', 5, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (6, 'Pantorrillas', 'Calves', 'pantorrillas', 'calves', 6, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (7, 'Espalda', 'Back', 'espalda', 'back', 7, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (8, 'Pecho', 'Chest', 'pecho', 'chest', 8, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (9, 'Hombros', 'Shoulders', 'hombros', 'shoulders', 9, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (10, 'Bíceps', 'Biceps', 'biceps', 'biceps', 10, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (11, 'Tríceps', 'Triceps', 'triceps', 'triceps', 11, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'),
  (12, 'Abdomen', 'Abs', 'abdomen', 'abs', 12, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z');
