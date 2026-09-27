CREATE TABLE IF NOT EXISTS conversaciones_directas (
  id SERIAL PRIMARY KEY,
  solicitante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  admin_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (solicitante_id, admin_id),
  CHECK (solicitante_id <> admin_id)
);

CREATE TABLE IF NOT EXISTS mensajes_directos (
  id SERIAL PRIMARY KEY,
  conversacion_id INTEGER NOT NULL REFERENCES conversaciones_directas(id) ON DELETE CASCADE,
  remitente_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  mensaje TEXT NOT NULL CHECK (length(trim(mensaje)) > 0),
  leido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS mensajes_directos_conversacion_fecha_idx
  ON mensajes_directos (conversacion_id, created_at);