CREATE TABLE IF NOT EXISTS usuarios_archivados (
  id SERIAL PRIMARY KEY,
  usuario_id_original INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL,
  departamento_nombre TEXT,
  eliminado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  eliminado_por_nombre TEXT,
  eliminado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actividad JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS usuarios_archivados_eliminado_en_idx
  ON usuarios_archivados (eliminado_en DESC);

DO $$
DECLARE
  reference RECORD;
  relation_name TEXT;
  constraint_name TEXT;
BEGIN
  FOR reference IN
    SELECT * FROM (VALUES
      ('adjuntos', 'subido_por_id'),
      ('mensajes_ticket', 'remitente_id'),
      ('proyectos_ti', 'creado_por_id'),
      ('tareas_it', 'asignado_a_id'),
      ('ticket_historial', 'usuario_id'),
      ('tickets', 'asignado_a_id')
    ) AS refs(table_name, column_name)
  LOOP
    relation_name := format('public.%I', reference.table_name);
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', relation_name, reference.column_name);

    FOR constraint_name IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.conrelid = relation_name::regclass
        AND c.confrelid = 'public.usuarios'::regclass
        AND array_length(c.conkey, 1) = 1
        AND a.attname = reference.column_name
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', relation_name, constraint_name);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.usuarios(id) ON DELETE SET NULL',
      relation_name,
      reference.table_name || '_' || reference.column_name || '_archived_user_fk',
      reference.column_name
    );
  END LOOP;
END $$;
