CREATE TABLE IF NOT EXISTS categorias_ticket (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS categorias_ticket_nombre_ci_idx
  ON categorias_ticket (LOWER(nombre)) WHERE activo = TRUE;

INSERT INTO categorias_ticket (nombre) VALUES
  ('Hardware'), ('Software'), ('Redes'), ('GPS / Rutas')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS inventario_departamentos (
  id SERIAL PRIMARY KEY,
  departamento_id INTEGER NOT NULL REFERENCES departamentos(id) ON DELETE CASCADE,
  nombre VARCHAR(160) NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad >= 0),
  ubicacion VARCHAR(160),
  notas TEXT,
  actualizado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS inventario_departamentos_departamento_idx
  ON inventario_departamentos (departamento_id, tipo, nombre);