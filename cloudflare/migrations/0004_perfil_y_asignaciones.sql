-- Etapa 4: perfil completo del cliente, observaciones privadas y asignación de rutinas (equivale a la Fase 7).
-- Solo agrega columnas y tablas: no cambia ni borra nada de lo que ya existe.

-- Perfil del cliente. Todo es opcional salvo nombre, apellidos y correo (ya existentes).
-- Estatura y peso en centésimas exactas (165.5 cm = 16550). Unidades: estatura 1 = cm, 2 = in; peso 1 = kg, 2 = lb.
-- experience_level: 1 principiante, 2 intermedio, 3 avanzado. training_location: 1 gimnasio, 2 casa, 3 exterior, 4 mixto.
-- available_days: suma de días (lunes 1, martes 2, miércoles 4, jueves 8, viernes 16, sábado 32, domingo 64).
ALTER TABLE clients ADD COLUMN birth_date TEXT;
ALTER TABLE clients ADD COLUMN height_centi INTEGER CHECK (height_centi IS NULL OR height_centi BETWEEN 0 AND 99999);
ALTER TABLE clients ADD COLUMN height_unit INTEGER CHECK (height_unit IS NULL OR height_unit IN (1, 2));
ALTER TABLE clients ADD COLUMN weight_centi INTEGER CHECK (weight_centi IS NULL OR weight_centi BETWEEN 0 AND 999999);
ALTER TABLE clients ADD COLUMN weight_unit INTEGER CHECK (weight_unit IS NULL OR weight_unit IN (1, 2));
ALTER TABLE clients ADD COLUMN experience_level INTEGER CHECK (experience_level IS NULL OR experience_level IN (1, 2, 3));
ALTER TABLE clients ADD COLUMN goal TEXT CHECK (goal IS NULL OR length(goal) <= 500);
ALTER TABLE clients ADD COLUMN training_location INTEGER CHECK (training_location IS NULL OR training_location IN (1, 2, 3, 4));
ALTER TABLE clients ADD COLUMN available_days INTEGER NOT NULL DEFAULT 0 CHECK (available_days BETWEEN 0 AND 127);
ALTER TABLE clients ADD COLUMN session_duration_minutes INTEGER CHECK (session_duration_minutes IS NULL OR session_duration_minutes BETWEEN 10 AND 300);
ALTER TABLE clients ADD COLUMN declared_limitations TEXT CHECK (declared_limitations IS NULL OR length(declared_limitations) <= 2000);
ALTER TABLE clients ADD COLUMN deactivated_at TEXT;

-- Observaciones privadas de la entrenadora. Nunca se muestran al cliente. No se editan ni se borran (historial).
CREATE TABLE client_notes (
  id             INTEGER PRIMARY KEY,
  client_id      INTEGER NOT NULL REFERENCES clients (id),
  author_user_id INTEGER NOT NULL REFERENCES users (id),
  content        TEXT    NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL
);
CREATE INDEX ix_client_notes_client ON client_notes (client_id, created_at);

CREATE TRIGGER tr_client_notes_no_update BEFORE UPDATE ON client_notes
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_client_notes_no_delete BEFORE DELETE ON client_notes
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

-- Asignación de una versión publicada a un cliente. Varios clientes comparten la misma versión sin copiarla.
-- status guardado: 1 programada, 2 vigente, 3 terminada, 4 cancelada, 5 reemplazada. Programada, vigente y
-- terminada por fecha se calculan con la fecha de hoy en el centro de México; terminada a mano y cancelada se guardan.
-- Las fechas son días de calendario (AAAA-MM-DD).
CREATE TABLE routine_assignments (
  id                  INTEGER PRIMARY KEY,
  client_id           INTEGER NOT NULL REFERENCES clients (id),
  routine_version_id  INTEGER NOT NULL REFERENCES routine_versions (id),
  assigned_by_user_id INTEGER NOT NULL REFERENCES users (id),
  start_date          TEXT    NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date            TEXT    CHECK (end_date IS NULL OR end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status              INTEGER NOT NULL CHECK (status IN (1, 2, 3, 4, 5)),
  status_changed_at   TEXT,
  notes               TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL,
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX ix_routine_assignments_client ON routine_assignments (client_id, status, start_date);
CREATE INDEX ix_routine_assignments_version ON routine_assignments (routine_version_id);

-- Solo se asignan versiones publicadas, la versión de una asignación no cambia y las asignaciones nunca se borran.
CREATE TRIGGER tr_routine_assignments_published_only BEFORE INSERT ON routine_assignments
WHEN (SELECT status FROM routine_versions WHERE id = NEW.routine_version_id) IS NOT 2
BEGIN
  SELECT RAISE(ABORT, 'assignment_requires_published_version');
END;

CREATE TRIGGER tr_routine_assignments_fixed_version BEFORE UPDATE OF routine_version_id, client_id ON routine_assignments
WHEN NEW.routine_version_id <> OLD.routine_version_id OR NEW.client_id <> OLD.client_id
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;

CREATE TRIGGER tr_routine_assignments_no_delete BEFORE DELETE ON routine_assignments
BEGIN
  SELECT RAISE(ABORT, 'history_is_permanent');
END;
