-- Supabase exposes the `public` schema through its Data API to the `anon` and
-- `authenticated` roles. XP never uses that API: it connects as the table
-- owner, which RLS does not restrict. Enabling RLS with no policies and
-- revoking the API roles closes that path without changing what the app sees.
--
-- The role checks keep this runnable on plain Postgres (CI, local), where the
-- Supabase roles do not exist.

DO $$
DECLARE
  t record;
  api_role text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      -- Tables created by later migrations (run as this same role) start closed too.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
