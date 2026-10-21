CREATE TABLE IF NOT EXISTS entregas_infraestructura_evidencias (
  id BIGSERIAL PRIMARY KEY,
  entrega_id INTEGER NOT NULL REFERENCES entregas_infraestructura(id) ON DELETE CASCADE,
  nombre_archivo VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  contenido BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS entregas_infraestructura_evidencias_entrega_idx
  ON entregas_infraestructura_evidencias (entrega_id, id);
