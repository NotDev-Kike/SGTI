-- Normaliza instalaciones existentes donde activos.id quedó sin autoincremento.
DO $$
DECLARE
  siguiente BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'activos_id_seq' AND n.nspname = 'public'
  ) THEN
    CREATE SEQUENCE public.activos_id_seq;
  END IF;

  SELECT COALESCE(MAX(id), 0) + 1 INTO siguiente FROM public.activos;
  PERFORM setval('public.activos_id_seq', siguiente, false);
  ALTER TABLE public.activos ALTER COLUMN id SET DEFAULT nextval('public.activos_id_seq');
END $$;
