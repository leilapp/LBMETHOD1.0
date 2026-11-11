-- Mejoras del 11/11/2026: pendientes de la entrenadora y avisos para el cliente.
-- Solo agrega tablas: no cambia ni borra nada de lo que ya existe.

-- Entrenamientos que la entrenadora ya revisó (para que sus comentarios dejen de salir como «nuevos» en su inicio).
-- Es una tabla aparte porque un entrenamiento finalizado no se puede modificar (disparadores de la etapa 5).
CREATE TABLE training_log_reviews (
  training_log_id INTEGER PRIMARY KEY REFERENCES training_logs (id),
  reviewed_at     TEXT    NOT NULL
);

-- Avisos de la entrenadora a un cliente, dentro de la app (no hay correos). Pueden responder a un entrenamiento.
-- El cliente los ve en su inicio; read_at marca cuándo los vio.
CREATE TABLE client_messages (
  id              INTEGER PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES clients (id),
  author_user_id  INTEGER NOT NULL REFERENCES users (id),
  training_log_id INTEGER REFERENCES training_logs (id),
  body            TEXT    NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at      TEXT    NOT NULL,
  read_at         TEXT
);
CREATE INDEX ix_client_messages_client ON client_messages (client_id, created_at);
CREATE INDEX ix_client_messages_log ON client_messages (training_log_id);
