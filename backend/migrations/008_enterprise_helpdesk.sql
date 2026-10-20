-- Capacidades empresariales: SLA, auditoría, activos, Microsoft 365 y seguridad.
CREATE TABLE IF NOT EXISTS sla_politicas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  prioridad VARCHAR(30) NOT NULL,
  categoria VARCHAR(100),
  horas_respuesta INTEGER NOT NULL CHECK (horas_respuesta > 0),
  horas_resolucion INTEGER NOT NULL CHECK (horas_resolucion > 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS sla_politicas_unica_idx ON sla_politicas (prioridad, COALESCE(categoria, '*')) WHERE activo = TRUE;
INSERT INTO sla_politicas (nombre, prioridad, categoria, horas_respuesta, horas_resolucion) VALUES
  ('Crítica', 'critica', NULL, 1, 4), ('Alta', 'alta', NULL, 4, 16),
  ('Media', 'media', NULL, 8, 32), ('Baja', 'baja', NULL, 24, 72)
ON CONFLICT DO NOTHING;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_politica_id INTEGER REFERENCES sla_politicas(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS fecha_limite_respuesta TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS asignacion_automatica BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS auditoria_eventos (
  id BIGSERIAL PRIMARY KEY, usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  evento VARCHAR(120) NOT NULL, entidad VARCHAR(80), entidad_id INTEGER,
  ip INET, user_agent TEXT, detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS auditoria_eventos_fecha_idx ON auditoria_eventos (created_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_eventos_usuario_idx ON auditoria_eventos (usuario_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activos (
  id SERIAL PRIMARY KEY, codigo VARCHAR(80) UNIQUE NOT NULL, nombre VARCHAR(160) NOT NULL,
  tipo VARCHAR(100) NOT NULL, marca VARCHAR(100), modelo VARCHAR(100), serie VARCHAR(120),
  departamento_id INTEGER REFERENCES departamentos(id) ON DELETE SET NULL,
  responsable_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  estado VARCHAR(40) NOT NULL DEFAULT 'disponible', motivo_baja TEXT,
  fecha_compra DATE, fecha_asignacion DATE, fecha_baja DATE, vida_util_anios INTEGER,
  orden_compra VARCHAR(120), garantia_hasta DATE, garantia_archivo BYTEA, garantia_nombre VARCHAR(255),
  fotografias JSONB NOT NULL DEFAULT '[]'::jsonb, notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS activos_historial (
  id BIGSERIAL PRIMARY KEY, activo_id INTEGER NOT NULL REFERENCES activos(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL, accion VARCHAR(100) NOT NULL,
  departamento_anterior_id INTEGER, departamento_nuevo_id INTEGER,
  responsable_anterior_id INTEGER, responsable_nuevo_id INTEGER, nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS activos_historial_activo_idx ON activos_historial (activo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS solicitudes_microsoft (
  id SERIAL PRIMARY KEY, solicitado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo VARCHAR(60) NOT NULL DEFAULT 'crear_usuario', nombre VARCHAR(160) NOT NULL,
  correo_solicitado VARCHAR(255), departamento VARCHAR(160), detalle TEXT,
  estado VARCHAR(40) NOT NULL DEFAULT 'pendiente', atendido_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS eventos_microsoft (
  id SERIAL PRIMARY KEY, usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  microsoft_id VARCHAR(255), titulo VARCHAR(255) NOT NULL, descripcion TEXT,
  inicio TIMESTAMPTZ NOT NULL, fin TIMESTAMPTZ NOT NULL, sincronizado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sesiones_usuario (
  id BIGSERIAL PRIMARY KEY, usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL, ip INET, user_agent TEXT, ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  conectado BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS archivos_admin (
  id BIGSERIAL PRIMARY KEY, enviado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  destinatario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL, nombre VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120), contenido BYTEA NOT NULL, leido BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS archivos_admin_destino_idx ON archivos_admin (destinatario_id, created_at DESC);
