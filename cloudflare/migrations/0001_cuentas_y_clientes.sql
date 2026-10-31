-- Etapa 1: cuentas (entrenadora y clientes), sesiones, perfil básico de clientes y bitácora de auditoría.
-- Fechas en UTC con formato ISO 8601 (texto); la zona horaria del centro de México se aplica al mostrar.

CREATE TABLE users (
  id                   INTEGER PRIMARY KEY,
  email                TEXT    NOT NULL COLLATE NOCASE UNIQUE,
  display_name         TEXT    NOT NULL,
  password_hash        TEXT    NOT NULL,              -- PBKDF2-SHA256 con sal; nunca la contraseña
  role                 TEXT    NOT NULL CHECK (role IN ('TRAINER', 'CLIENT')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_enabled           INTEGER NOT NULL DEFAULT 1,
  failed_logins        INTEGER NOT NULL DEFAULT 0,
  lockout_until        TEXT,
  last_login_at        TEXT,
  created_at           TEXT    NOT NULL
);

-- Solo se guarda la huella SHA-256 del token: quien lea la base no puede usar las sesiones.
CREATE TABLE sessions (
  id           TEXT    PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users (id),
  created_at   TEXT    NOT NULL,
  expires_at   TEXT    NOT NULL,
  last_seen_at TEXT    NOT NULL
);
CREATE INDEX ix_sessions_user ON sessions (user_id);

CREATE TABLE clients (
  id          INTEGER PRIMARY KEY,
  trainer_id  INTEGER NOT NULL REFERENCES users (id),   -- separación de datos por entrenadora
  user_id     INTEGER UNIQUE REFERENCES users (id),     -- cuenta del cliente (si tiene)
  first_name  TEXT    NOT NULL,
  last_name   TEXT    NOT NULL,
  email       TEXT    NOT NULL COLLATE NOCASE,
  phone       TEXT,
  status      TEXT    NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
CREATE INDEX ix_clients_trainer ON clients (trainer_id, last_name, first_name);

-- Límite de intentos de inicio de sesión por dirección IP (ventanas de un minuto).
CREATE TABLE login_rate (
  ip           TEXT    NOT NULL,
  window_start TEXT    NOT NULL,
  attempts     INTEGER NOT NULL,
  PRIMARY KEY (ip, window_start)
);

CREATE TABLE audit_logs (
  id          INTEGER PRIMARY KEY,
  occurred_at TEXT    NOT NULL,
  user_id     INTEGER,
  action      TEXT    NOT NULL,
  entity_type TEXT    NOT NULL,
  entity_id   TEXT,
  details     TEXT
);
CREATE INDEX ix_audit_logs_entity ON audit_logs (entity_type, entity_id);
