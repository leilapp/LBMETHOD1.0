-- «Olvidé mi contraseña» sin correo, solo para la entrenadora: códigos de recuperación de un solo uso.
-- La entrenadora los genera en Configuración (se muestran una sola vez para que los guarde en un lugar seguro).
-- Solo se guarda la huella SHA-256 de cada código: quien lea la base no puede usarlos.
CREATE TABLE recovery_codes (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id),
  code_hash  TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  used_at    TEXT
);
CREATE INDEX ix_recovery_codes_user ON recovery_codes (user_id, code_hash);
