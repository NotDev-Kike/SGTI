CREATE TABLE IF NOT EXISTS entregas_infraestructura (
  id SERIAL PRIMARY KEY,
  departamento_id INTEGER REFERENCES departamentos(id) ON DELETE SET NULL,
  departamento_nombre VARCHAR(120) NOT NULL,
  destinatario VARCHAR(160) NOT NULL,
  fecha_entrega DATE NOT NULL,
  observaciones TEXT,
  entregado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  entregado_por_nombre VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entregas_infraestructura_articulos (
  id SERIAL PRIMARY KEY,
  entrega_id INTEGER NOT NULL REFERENCES entregas_infraestructura(id) ON DELETE CASCADE,
  articulo VARCHAR(160) NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  detalles TEXT
);

CREATE INDEX IF NOT EXISTS entregas_infraestructura_fecha_idx
  ON entregas_infraestructura (fecha_entrega DESC, id DESC);

CREATE INDEX IF NOT EXISTS entregas_infraestructura_articulos_entrega_idx
  ON entregas_infraestructura_articulos (entrega_id, id);