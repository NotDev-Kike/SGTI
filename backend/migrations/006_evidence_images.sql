CREATE TABLE IF NOT EXISTS imagenes_evidencia (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  mensaje_ticket_id INTEGER REFERENCES mensajes_ticket(id) ON DELETE CASCADE,
  mensaje_directo_id INTEGER REFERENCES mensajes_directos(id) ON DELETE CASCADE,
  subido_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre_archivo TEXT NOT NULL,
  mime_type VARCHAR(32) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  tamano_bytes INTEGER NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760),
  contenido BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (mensaje_directo_id IS NOT NULL AND ticket_id IS NULL AND mensaje_ticket_id IS NULL)
    OR
    (mensaje_directo_id IS NULL AND ticket_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS imagenes_evidencia_ticket_idx
  ON imagenes_evidencia (ticket_id, id) WHERE ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS imagenes_evidencia_mensaje_ticket_idx
  ON imagenes_evidencia (mensaje_ticket_id, id) WHERE mensaje_ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS imagenes_evidencia_mensaje_directo_idx
  ON imagenes_evidencia (mensaje_directo_id, id) WHERE mensaje_directo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS imagenes_evidencia_subido_por_idx
  ON imagenes_evidencia (subido_por_id, id) WHERE subido_por_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS usuarios_archivados_imagenes (
  id SERIAL PRIMARY KEY,
  usuario_archivado_id INTEGER NOT NULL REFERENCES usuarios_archivados(id) ON DELETE CASCADE,
  imagen_original_id INTEGER NOT NULL,
  ticket_id_original INTEGER,
  nombre_archivo TEXT NOT NULL,
  mime_type VARCHAR(32) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  tamano_bytes INTEGER NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760),
  contenido BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS usuarios_archivados_imagenes_archive_idx
  ON usuarios_archivados_imagenes (usuario_archivado_id, id);
