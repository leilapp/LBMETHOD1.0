-- Etapa 5: registro de entrenamientos del cliente (equivale a la Fase 8).
-- Solo agrega tablas: no cambia ni borra nada de lo que ya existe.
--
-- Al iniciar un entrenamiento se copia lo prescrito (instantánea), de modo que el historial no cambia aunque la
-- rutina o el ejercicio se editen después. El cliente solo registra lo que hizo; nunca modifica la rutina.
-- Pesos en centésimas exactas (62.5 kg = 6250); unidad 1 = kg, 2 = lb. RIR y RPE en pasos de 0.5.

-- status: 1 en curso, 2 finalizado. Un cliente solo puede tener un entrenamiento en curso (índice único parcial):
-- retomar continúa el mismo y un doble toque no crea duplicados.
CREATE TABLE training_logs (
  id                     INTEGER PRIMARY KEY,
  client_id              INTEGER NOT NULL REFERENCES clients (id),
  -- Referencias de trazabilidad; lo que se muestra sale de la instantánea.
  routine_assignment_id  INTEGER REFERENCES routine_assignments (id),
  routine_day_id         INTEGER REFERENCES routine_days (id),
  routine_title          TEXT,
  routine_version_number INTEGER,
  day_name               TEXT,
  status                 INTEGER NOT NULL DEFAULT 1 CHECK (status IN (1, 2)),
  started_at             TEXT    NOT NULL,
  completed_at           TEXT,
  comment                TEXT    CHECK (comment IS NULL OR length(comment) <= 2000),
  created_at             TEXT    NOT NULL,
  updated_at             TEXT    NOT NULL,
  CHECK (status <> 2 OR completed_at IS NOT NULL)
);
CREATE UNIQUE INDEX ux_training_logs_one_in_progress ON training_logs (client_id) WHERE status = 1;
CREATE INDEX ix_training_logs_client ON training_logs (client_id, started_at);
CREATE INDEX ix_training_logs_assignment ON training_logs (routine_assignment_id, started_at);

CREATE TABLE training_log_exercises (
  id                       INTEGER PRIMARY KEY,
  training_log_id          INTEGER NOT NULL REFERENCES training_logs (id),
  exercise_id              INTEGER NOT NULL REFERENCES exercises (id),
  routine_exercise_id      INTEGER REFERENCES routine_exercises (id),
  position                 INTEGER NOT NULL CHECK (position >= 1),
  -- Instantánea de lo prescrito al iniciar.
  exercise_name_es         TEXT    NOT NULL,
  exercise_name_en         TEXT,
  superset_group           TEXT,
  prescribed_sets          INTEGER,
  prescribed_reps_min      INTEGER,
  prescribed_reps_max      INTEGER,
  prescribed_weight_centi  INTEGER,
  prescribed_weight_unit   INTEGER,
  prescribed_rest_seconds  INTEGER,
  prescribed_tempo         TEXT,
  prescribed_rir           REAL,
  prescribed_rpe           REAL,
  prescribed_notes         TEXT,
  -- Lo que registra el cliente.
  is_completed             INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  comment                  TEXT    CHECK (comment IS NULL OR length(comment) <= 1000),
  created_at               TEXT    NOT NULL,
  updated_at               TEXT    NOT NULL,
  UNIQUE (training_log_id, position)
);
CREATE INDEX ix_training_log_exercises_exercise ON training_log_exercises (exercise_id);

-- Una serie: lo prescrito para ella (si la rutina lo indicaba) y lo realmente hecho. Las series extra que agrega el
-- cliente tienen is_prescribed = 0 y no traen prescripción.
CREATE TABLE training_log_sets (
  id                       INTEGER PRIMARY KEY,
  training_log_exercise_id INTEGER NOT NULL REFERENCES training_log_exercises (id),
  set_number               INTEGER NOT NULL CHECK (set_number BETWEEN 1 AND 100),
  set_type                 INTEGER NOT NULL DEFAULT 1 CHECK (set_type IN (1, 2, 3, 4, 5, 6, 99)),
  is_prescribed            INTEGER NOT NULL CHECK (is_prescribed IN (0, 1)),
  prescribed_reps_min      INTEGER,
  prescribed_reps_max      INTEGER,
  prescribed_weight_centi  INTEGER,
  prescribed_weight_unit   INTEGER,
  prescribed_rest_seconds  INTEGER,
  prescribed_rir           REAL,
  prescribed_rpe           REAL,
  prescribed_notes         TEXT,
  reps                     INTEGER CHECK (reps IS NULL OR reps BETWEEN 0 AND 1000),
  weight_centi             INTEGER CHECK (weight_centi IS NULL OR weight_centi BETWEEN 0 AND 200000),
  weight_unit              INTEGER CHECK (weight_unit IS NULL OR weight_unit IN (1, 2)),
  rir                      REAL    CHECK (rir IS NULL OR (rir BETWEEN 0 AND 10 AND rir * 2 = CAST(rir * 2 AS INTEGER))),
  rpe                      REAL    CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10 AND rpe * 2 = CAST(rpe * 2 AS INTEGER))),
  is_completed             INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  notes                    TEXT    CHECK (notes IS NULL OR length(notes) <= 500),
  created_at               TEXT    NOT NULL,
  updated_at               TEXT    NOT NULL,
  UNIQUE (training_log_exercise_id, set_number),
  CHECK (weight_centi IS NULL OR weight_unit IS NOT NULL)
);

-- Protecciones del historial en la propia base de datos (aunque un error de programación lo intentara):
-- los entrenamientos nunca se borran; uno finalizado ya no cambia; lo prescrito no se edita; las series prescritas
-- no se quitan.
CREATE TRIGGER tr_training_logs_no_delete BEFORE DELETE ON training_logs
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_logs_completed BEFORE UPDATE ON training_logs
WHEN OLD.status = 2
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_logs_snapshot BEFORE UPDATE ON training_logs
WHEN NEW.client_id IS NOT OLD.client_id OR NEW.routine_assignment_id IS NOT OLD.routine_assignment_id
  OR NEW.routine_day_id IS NOT OLD.routine_day_id OR NEW.routine_title IS NOT OLD.routine_title
  OR NEW.routine_version_number IS NOT OLD.routine_version_number OR NEW.day_name IS NOT OLD.day_name
  OR NEW.started_at IS NOT OLD.started_at
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_log_exercises_no_delete BEFORE DELETE ON training_log_exercises
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_log_exercises_completed_insert BEFORE INSERT ON training_log_exercises
WHEN (SELECT status FROM training_logs WHERE id = NEW.training_log_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_log_exercises_completed_update BEFORE UPDATE ON training_log_exercises
WHEN (SELECT status FROM training_logs WHERE id = OLD.training_log_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_log_exercises_snapshot BEFORE UPDATE ON training_log_exercises
WHEN NEW.training_log_id IS NOT OLD.training_log_id OR NEW.exercise_id IS NOT OLD.exercise_id
  OR NEW.routine_exercise_id IS NOT OLD.routine_exercise_id OR NEW.position IS NOT OLD.position
  OR NEW.exercise_name_es IS NOT OLD.exercise_name_es OR NEW.exercise_name_en IS NOT OLD.exercise_name_en
  OR NEW.superset_group IS NOT OLD.superset_group OR NEW.prescribed_sets IS NOT OLD.prescribed_sets
  OR NEW.prescribed_reps_min IS NOT OLD.prescribed_reps_min OR NEW.prescribed_reps_max IS NOT OLD.prescribed_reps_max
  OR NEW.prescribed_weight_centi IS NOT OLD.prescribed_weight_centi OR NEW.prescribed_weight_unit IS NOT OLD.prescribed_weight_unit
  OR NEW.prescribed_rest_seconds IS NOT OLD.prescribed_rest_seconds OR NEW.prescribed_tempo IS NOT OLD.prescribed_tempo
  OR NEW.prescribed_rir IS NOT OLD.prescribed_rir OR NEW.prescribed_rpe IS NOT OLD.prescribed_rpe
  OR NEW.prescribed_notes IS NOT OLD.prescribed_notes
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_log_sets_completed_insert BEFORE INSERT ON training_log_sets
WHEN (SELECT l.status FROM training_log_exercises e JOIN training_logs l ON l.id = e.training_log_id WHERE e.id = NEW.training_log_exercise_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_log_sets_completed_update BEFORE UPDATE ON training_log_sets
WHEN (SELECT l.status FROM training_log_exercises e JOIN training_logs l ON l.id = e.training_log_id WHERE e.id = OLD.training_log_exercise_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_log_sets_delete BEFORE DELETE ON training_log_sets
WHEN OLD.is_prescribed = 1
  OR (SELECT l.status FROM training_log_exercises e JOIN training_logs l ON l.id = e.training_log_id WHERE e.id = OLD.training_log_exercise_id) = 2
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_training_log_sets_snapshot BEFORE UPDATE ON training_log_sets
WHEN NEW.training_log_exercise_id IS NOT OLD.training_log_exercise_id OR NEW.set_number IS NOT OLD.set_number
  OR NEW.set_type IS NOT OLD.set_type OR NEW.is_prescribed IS NOT OLD.is_prescribed
  OR NEW.prescribed_reps_min IS NOT OLD.prescribed_reps_min OR NEW.prescribed_reps_max IS NOT OLD.prescribed_reps_max
  OR NEW.prescribed_weight_centi IS NOT OLD.prescribed_weight_centi OR NEW.prescribed_weight_unit IS NOT OLD.prescribed_weight_unit
  OR NEW.prescribed_rest_seconds IS NOT OLD.prescribed_rest_seconds OR NEW.prescribed_rir IS NOT OLD.prescribed_rir
  OR NEW.prescribed_rpe IS NOT OLD.prescribed_rpe OR NEW.prescribed_notes IS NOT OLD.prescribed_notes
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;
