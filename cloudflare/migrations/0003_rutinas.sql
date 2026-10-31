-- Etapa 3: constructor manual de rutinas y plantillas (equivale a la Fase 6).
-- La entrenadora decide cada día, ejercicio y parámetro; aquí solo se guarda lo que ella escribe.
-- Una versión publicada es fija para siempre: los disparadores (triggers) del final lo impiden en la base misma.

-- kind: 1 = programa (se asigna a clientes), 2 = plantilla. status: 1 = activa, 2 = archivada.
CREATE TABLE routines (
  id          INTEGER PRIMARY KEY,
  trainer_id  INTEGER NOT NULL REFERENCES users (id),
  kind        INTEGER NOT NULL CHECK (kind IN (1, 2)),
  name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 150),
  name_key    TEXT    NOT NULL,
  status      INTEGER NOT NULL DEFAULT 1 CHECK (status IN (1, 2)),
  archived_at TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
CREATE INDEX ix_routines_trainer ON routines (trainer_id, kind, status, updated_at);

-- status: 1 = borrador, 2 = publicada. Las versiones nunca se borran salvo un borrador descartado.
CREATE TABLE routine_versions (
  id                   INTEGER PRIMARY KEY,
  routine_id           INTEGER NOT NULL REFERENCES routines (id),
  version_number       INTEGER NOT NULL CHECK (version_number >= 1),
  status               INTEGER NOT NULL DEFAULT 1 CHECK (status IN (1, 2)),
  title                TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 150),
  description          TEXT    CHECK (description IS NULL OR length(description) <= 2000),
  goal                 TEXT    CHECK (goal IS NULL OR length(goal) <= 500),
  duration_weeks       INTEGER CHECK (duration_weeks IS NULL OR duration_weeks BETWEEN 1 AND 104),
  change_notes         TEXT    CHECK (change_notes IS NULL OR length(change_notes) <= 1000),
  -- Origen (versión anterior, plantilla o rutina duplicada). Es solo una referencia de trazabilidad, sin llave
  -- foránea: el origen puede ser un borrador que después se descarta.
  source_version_id    INTEGER,
  published_at         TEXT,
  published_by_user_id INTEGER REFERENCES users (id),
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL,
  UNIQUE (routine_id, version_number),
  CHECK (status <> 2 OR published_at IS NOT NULL)
);
-- Un solo borrador por rutina.
CREATE UNIQUE INDEX ux_routine_versions_one_draft ON routine_versions (routine_id) WHERE status = 1;

-- day_of_week: 0 = domingo … 6 = sábado (igual que la versión .NET).
CREATE TABLE routine_days (
  id                 INTEGER PRIMARY KEY,
  routine_version_id INTEGER NOT NULL REFERENCES routine_versions (id) ON DELETE CASCADE,
  position           INTEGER NOT NULL CHECK (position >= 1),
  name               TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  day_of_week        INTEGER CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
  notes              TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  UNIQUE (routine_version_id, position)
);

-- Los pesos se guardan en centésimas exactas (60.25 kg = 6025) para no perder decimales.
-- set_type: 1 efectiva, 2 calentamiento, 3 dropset, 4 al fallo, 5 rest-pause, 6 back-off, 99 otra.
-- weight_unit: 1 = kg, 2 = lb. RIR y RPE: enteros o medios.
CREATE TABLE routine_exercises (
  id                     INTEGER PRIMARY KEY,
  routine_day_id         INTEGER NOT NULL REFERENCES routine_days (id) ON DELETE CASCADE,
  exercise_id            INTEGER NOT NULL REFERENCES exercises (id),
  position               INTEGER NOT NULL CHECK (position >= 1),
  superset_group         TEXT    CHECK (superset_group IS NULL OR length(superset_group) <= 10),
  sets                   INTEGER NOT NULL CHECK (sets BETWEEN 1 AND 30),
  reps_min               INTEGER CHECK (reps_min IS NULL OR reps_min BETWEEN 0 AND 1000),
  reps_max               INTEGER CHECK (reps_max IS NULL OR reps_max BETWEEN 0 AND 1000),
  suggested_weight_centi INTEGER CHECK (suggested_weight_centi IS NULL OR suggested_weight_centi BETWEEN 0 AND 200000),
  suggested_weight_unit  INTEGER CHECK (suggested_weight_unit IS NULL OR suggested_weight_unit IN (1, 2)),
  rest_seconds           INTEGER CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600),
  tempo                  TEXT    CHECK (tempo IS NULL OR length(tempo) <= 20),
  rir                    REAL    CHECK (rir IS NULL OR (rir BETWEEN 0 AND 10 AND rir * 2 = CAST(rir * 2 AS INTEGER))),
  rpe                    REAL    CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10 AND rpe * 2 = CAST(rpe * 2 AS INTEGER))),
  set_type               INTEGER NOT NULL DEFAULT 1 CHECK (set_type IN (1, 2, 3, 4, 5, 6, 99)),
  notes                  TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL,
  UNIQUE (routine_day_id, position),
  CHECK (reps_min IS NULL OR reps_max IS NULL OR reps_min <= reps_max),
  CHECK (suggested_weight_centi IS NULL OR suggested_weight_unit IS NOT NULL)
);
CREATE INDEX ix_routine_exercises_exercise ON routine_exercises (exercise_id);

-- Detalle opcional serie por serie (por ejemplo, 1 de calentamiento y 3 efectivas).
CREATE TABLE routine_exercise_sets (
  id                     INTEGER PRIMARY KEY,
  routine_exercise_id    INTEGER NOT NULL REFERENCES routine_exercises (id) ON DELETE CASCADE,
  set_number             INTEGER NOT NULL CHECK (set_number >= 1),
  set_type               INTEGER NOT NULL DEFAULT 1 CHECK (set_type IN (1, 2, 3, 4, 5, 6, 99)),
  reps_min               INTEGER CHECK (reps_min IS NULL OR reps_min BETWEEN 0 AND 1000),
  reps_max               INTEGER CHECK (reps_max IS NULL OR reps_max BETWEEN 0 AND 1000),
  suggested_weight_centi INTEGER CHECK (suggested_weight_centi IS NULL OR suggested_weight_centi BETWEEN 0 AND 200000),
  suggested_weight_unit  INTEGER CHECK (suggested_weight_unit IS NULL OR suggested_weight_unit IN (1, 2)),
  rest_seconds           INTEGER CHECK (rest_seconds IS NULL OR rest_seconds BETWEEN 0 AND 3600),
  rir                    REAL    CHECK (rir IS NULL OR (rir BETWEEN 0 AND 10 AND rir * 2 = CAST(rir * 2 AS INTEGER))),
  rpe                    REAL    CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10 AND rpe * 2 = CAST(rpe * 2 AS INTEGER))),
  notes                  TEXT    CHECK (notes IS NULL OR length(notes) <= 500),
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL,
  UNIQUE (routine_exercise_id, set_number),
  CHECK (reps_min IS NULL OR reps_max IS NULL OR reps_min <= reps_max),
  CHECK (suggested_weight_centi IS NULL OR suggested_weight_unit IS NOT NULL)
);

-- ---------- Versión publicada inmutable ----------
-- Cualquier intento de cambiar, borrar o agregar contenido a una versión publicada se rechaza en la base,
-- aunque llegue por un error del programa. Publicar (pasar de borrador a publicada) sí está permitido.

CREATE TRIGGER tr_routine_versions_published_update BEFORE UPDATE ON routine_versions
WHEN OLD.status = 2
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_versions_published_delete BEFORE DELETE ON routine_versions
WHEN OLD.status = 2
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_days_published_insert BEFORE INSERT ON routine_days
WHEN (SELECT status FROM routine_versions WHERE id = NEW.routine_version_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_days_published_update BEFORE UPDATE ON routine_days
WHEN EXISTS (SELECT 1 FROM routine_versions WHERE id IN (OLD.routine_version_id, NEW.routine_version_id) AND status = 2)
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_days_published_delete BEFORE DELETE ON routine_days
WHEN (SELECT status FROM routine_versions WHERE id = OLD.routine_version_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_exercises_published_insert BEFORE INSERT ON routine_exercises
WHEN (SELECT v.status FROM routine_days d JOIN routine_versions v ON v.id = d.routine_version_id WHERE d.id = NEW.routine_day_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_exercises_published_update BEFORE UPDATE ON routine_exercises
WHEN EXISTS (SELECT 1 FROM routine_days d JOIN routine_versions v ON v.id = d.routine_version_id
              WHERE d.id IN (OLD.routine_day_id, NEW.routine_day_id) AND v.status = 2)
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_exercises_published_delete BEFORE DELETE ON routine_exercises
WHEN (SELECT v.status FROM routine_days d JOIN routine_versions v ON v.id = d.routine_version_id WHERE d.id = OLD.routine_day_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_exercise_sets_published_insert BEFORE INSERT ON routine_exercise_sets
WHEN (SELECT v.status FROM routine_exercises e JOIN routine_days d ON d.id = e.routine_day_id
        JOIN routine_versions v ON v.id = d.routine_version_id WHERE e.id = NEW.routine_exercise_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_exercise_sets_published_update BEFORE UPDATE ON routine_exercise_sets
WHEN EXISTS (SELECT 1 FROM routine_exercises e JOIN routine_days d ON d.id = e.routine_day_id
               JOIN routine_versions v ON v.id = d.routine_version_id
              WHERE e.id IN (OLD.routine_exercise_id, NEW.routine_exercise_id) AND v.status = 2)
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;

CREATE TRIGGER tr_routine_exercise_sets_published_delete BEFORE DELETE ON routine_exercise_sets
WHEN (SELECT v.status FROM routine_exercises e JOIN routine_days d ON d.id = e.routine_day_id
        JOIN routine_versions v ON v.id = d.routine_version_id WHERE e.id = OLD.routine_exercise_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'published_version_immutable');
END;
