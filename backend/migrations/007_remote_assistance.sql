CREATE TABLE IF NOT EXISTS solicitudes_asistencia_remota (
  id SERIAL PRIMARY KEY,
  solicitante_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  solicitante_nombre TEXT NOT NULL,
  solicitante_email TEXT NOT NULL,
  anydesk_id VARCHAR(120) NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '' CHECK (char_length(descripcion) <= 1000),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'atendiendo', 'completada', 'cancelada')),
  atendido_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  atendido_por_nombre TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  iniciada_en TIMESTAMPTZ,
  completada_en TIMESTAMPTZ,
  actualizada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_asistencia_remota_usuario_activa_idx
  ON solicitudes_asistencia_remota (solicitante_id)
  WHERE solicitante_id IS NOT NULL AND estado IN ('pendiente', 'atendiendo');

CREATE INDEX IF NOT EXISTS solicitudes_asistencia_remota_cola_idx
  ON solicitudes_asistencia_remota (estado, creada_en, id);

CREATE INDEX IF NOT EXISTS solicitudes_asistencia_remota_atendedor_activo_idx
  ON solicitudes_asistencia_remota (atendido_por_id)
  WHERE estado = 'atendiendo' AND atendido_por_id IS NOT NULL;
