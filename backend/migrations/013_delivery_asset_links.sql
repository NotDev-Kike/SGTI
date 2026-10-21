ALTER TABLE entregas_infraestructura_articulos
  ADD COLUMN IF NOT EXISTS activo_id INTEGER REFERENCES activos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS entregas_infraestructura_articulos_activo_idx
  ON entregas_infraestructura_articulos (activo_id);
