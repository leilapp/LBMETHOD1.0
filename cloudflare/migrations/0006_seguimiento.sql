-- Etapa 6: medidas, evaluaciones, fotos de progreso privadas y calendario (equivale a la Fase 9).
-- Solo agrega tablas y una columna: no cambia ni borra nada de lo que ya existe.
-- Nada de esto se borra: una medida mal capturada se corrige (y la corrección queda en la bitácora) y un evento del
-- calendario se cancela.

-- Dueña de un archivo privado (fotos de progreso). Las imágenes de la biblioteca no tienen cliente.
ALTER TABLE stored_files ADD COLUMN owner_client_id INTEGER REFERENCES clients (id);

-- Tipos de medida configurables. kind: 1 peso corporal, 2 perímetro, 3 composición corporal, 99 otra.
-- La unidad queda fija en cuanto hay medidas con ese tipo (se revisa en la API y aquí abajo con un disparador).
CREATE TABLE measurement_types (
  id          INTEGER PRIMARY KEY,
  name_es     TEXT    NOT NULL CHECK (length(name_es) BETWEEN 1 AND 100),
  name_en     TEXT    NOT NULL CHECK (length(name_en) BETWEEN 1 AND 100),
  name_es_key TEXT    NOT NULL UNIQUE,
  name_en_key TEXT    NOT NULL UNIQUE,
  kind        INTEGER NOT NULL CHECK (kind IN (1, 2, 3, 99)),
  unit        TEXT    NOT NULL CHECK (unit IN ('kg', 'lb', 'cm', 'in', '%')),
  sort_order  INTEGER NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

-- Catálogo inicial de la guía maestra (no son datos de ejemplo); la entrenadora puede editarlo.
INSERT INTO measurement_types (id, name_es, name_en, name_es_key, name_en_key, kind, unit, sort_order, created_at, updated_at) VALUES
  (1, 'Peso corporal', 'Body weight', 'peso corporal', 'body weight', 1, 'kg', 1, '2026-10-31T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
  (2, 'Cintura', 'Waist', 'cintura', 'waist', 2, 'cm', 2, '2026-10-31T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
  (3, 'Cadera', 'Hips', 'cadera', 'hips', 2, 'cm', 3, '2026-10-31T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
  (4, 'Glúteos', 'Glutes', 'gluteos', 'glutes', 2, 'cm', 4, '2026-10-31T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
  (5, 'Muslo', 'Thigh', 'muslo', 'thigh', 2, 'cm', 5, '2026-10-31T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
  (6, 'Brazo', 'Arm', 'brazo', 'arm', 2, 'cm', 6, '2026-10-31T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
  (7, 'Pantorrilla', 'Calf', 'pantorrilla', 'calf', 2, 'cm', 7, '2026-10-31T00:00:00.000Z', '2026-10-31T00:00:00.000Z');

-- Evaluación de un cliente en una fecha: agrupa medidas y fotos para compararlas.
CREATE TABLE evaluations (
  id                   INTEGER PRIMARY KEY,
  client_id            INTEGER NOT NULL REFERENCES clients (id),
  evaluated_on         TEXT    NOT NULL CHECK (evaluated_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  performed_by_user_id INTEGER NOT NULL REFERENCES users (id),
  notes                TEXT    CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL
);
CREATE INDEX ix_evaluations_client ON evaluations (client_id, evaluated_on);

-- Valor medido, en centésimas exactas (62.8 kg = 6280). Guarda su propia unidad (copiada del tipo al registrarse)
-- para que un cambio posterior en la configuración no altere el historial.
CREATE TABLE measurements (
  id                  INTEGER PRIMARY KEY,
  client_id           INTEGER NOT NULL REFERENCES clients (id),
  measurement_type_id INTEGER NOT NULL REFERENCES measurement_types (id),
  evaluation_id       INTEGER REFERENCES evaluations (id),
  measured_on         TEXT    NOT NULL,
  value_centi         INTEGER NOT NULL CHECK (value_centi BETWEEN 1 AND 9999999),
  unit                TEXT    NOT NULL,
  recorded_by_user_id INTEGER NOT NULL REFERENCES users (id),
  notes               TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL
);
CREATE INDEX ix_measurements_client ON measurements (client_id, measurement_type_id, measured_on);
CREATE INDEX ix_measurements_evaluation ON measurements (evaluation_id);

-- Foto de progreso privada (archivo en R2, sin dirección pública). category: 1 frente, 2 perfil, 3 espalda, 99 otra.
CREATE TABLE progress_photos (
  id             INTEGER PRIMARY KEY,
  client_id      INTEGER NOT NULL REFERENCES clients (id),
  stored_file_id TEXT    NOT NULL UNIQUE REFERENCES stored_files (id),
  evaluation_id  INTEGER REFERENCES evaluations (id),
  taken_on       TEXT    NOT NULL,
  category       INTEGER CHECK (category IS NULL OR category IN (1, 2, 3, 99)),
  notes          TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at     TEXT    NOT NULL
);
CREATE INDEX ix_progress_photos_client ON progress_photos (client_id, taken_on);

-- Evento del calendario de un cliente (o general de la entrenadora si client_id es nulo).
-- type: 1 entrenamiento, 2 descanso, 3 evaluación, 4 inicio de programa, 5 fin de programa, 99 otro.
-- status: 1 programado, 2 hecho, 3 cancelado. Horas opcionales HH:MM:SS.
CREATE TABLE calendar_events (
  id                    INTEGER PRIMARY KEY,
  trainer_id            INTEGER NOT NULL REFERENCES users (id),
  client_id             INTEGER REFERENCES clients (id),
  type                  INTEGER NOT NULL CHECK (type IN (1, 2, 3, 4, 5, 99)),
  status                INTEGER NOT NULL DEFAULT 1 CHECK (status IN (1, 2, 3)),
  title                 TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 150),
  date                  TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  start_time            TEXT    CHECK (start_time IS NULL OR start_time GLOB '[0-2][0-9]:[0-5][0-9]:[0-5][0-9]'),
  end_time              TEXT    CHECK (end_time IS NULL OR end_time GLOB '[0-2][0-9]:[0-5][0-9]:[0-5][0-9]'),
  notes                 TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
  routine_assignment_id INTEGER REFERENCES routine_assignments (id),
  routine_day_id        INTEGER REFERENCES routine_days (id),
  training_log_id       INTEGER REFERENCES training_logs (id),
  evaluation_id         INTEGER REFERENCES evaluations (id),
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL,
  CHECK (end_time IS NULL OR (start_time IS NOT NULL AND end_time >= start_time))
);
CREATE INDEX ix_calendar_events_trainer ON calendar_events (trainer_id, date);
CREATE INDEX ix_calendar_events_client ON calendar_events (client_id, date);

-- Protecciones del historial en la propia base de datos.
CREATE TRIGGER tr_evaluations_no_delete BEFORE DELETE ON evaluations
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_evaluations_fixed_client BEFORE UPDATE OF client_id ON evaluations
WHEN NEW.client_id IS NOT OLD.client_id
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_measurements_no_delete BEFORE DELETE ON measurements
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_measurements_fixed BEFORE UPDATE ON measurements
WHEN NEW.client_id IS NOT OLD.client_id OR NEW.measurement_type_id IS NOT OLD.measurement_type_id
  OR NEW.unit IS NOT OLD.unit OR NEW.evaluation_id IS NOT OLD.evaluation_id
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_measurement_types_unit_fixed BEFORE UPDATE OF unit, kind ON measurement_types
WHEN (NEW.unit IS NOT OLD.unit OR NEW.kind IS NOT OLD.kind) AND EXISTS (SELECT 1 FROM measurements WHERE measurement_type_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_measurement_types_no_delete BEFORE DELETE ON measurement_types
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_progress_photos_no_delete BEFORE DELETE ON progress_photos
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_progress_photos_fixed BEFORE UPDATE ON progress_photos
WHEN NEW.client_id IS NOT OLD.client_id OR NEW.stored_file_id IS NOT OLD.stored_file_id
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_calendar_events_no_delete BEFORE DELETE ON calendar_events
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

-- Un evento hecho o cancelado ya no cambia.
CREATE TRIGGER tr_calendar_events_closed BEFORE UPDATE ON calendar_events
WHEN OLD.status <> 1
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;
