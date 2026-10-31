-- Ajustes internos de la aplicación. Hoy solo guarda la llave con la que se firman los tokens CSRF cuando no se
-- configuró el secreto APP_SECRET en Cloudflare: el Worker la genera al azar la primera vez y la reutiliza.
-- Así la app funciona sin pasos manuales; si después se define APP_SECRET, se usa ese y esta fila se ignora.
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL
);
