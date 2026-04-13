-- Rebuild RLS policies for owner-based access control on core tables.
-- Task reference: review/tasks/04-rls-rebuild.md

DO $$
DECLARE
  target_table text;
  existing_policy record;
BEGIN
  FOR target_table IN
    SELECT unnest(ARRAY[
      'residents',
      'relations',
      'feelings',
      'nicknames',
      'events',
      'topic_threads',
      'notifications',
      'consult_answers',
      'shared_snippets',
      'recent_events',
      'offscreen_knowledge',
      'world_states',
      'player_profiles',
      'presets'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = target_table
    ) THEN
      RAISE EXCEPTION 'RLS rebuild target table is missing: public.%', target_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'owner_id'
    ) THEN
      RAISE EXCEPTION 'RLS rebuild target table does not have owner_id: public.%', target_table;
    END IF;

    FOR existing_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I;',
        existing_policy.policyname,
        target_table
      );
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', target_table);

    EXECUTE format(
      'CREATE POLICY owner_select ON public.%I FOR SELECT USING (owner_id = auth.uid());',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY owner_insert ON public.%I FOR INSERT WITH CHECK (owner_id = auth.uid());',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY owner_update ON public.%I FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());',
      target_table
    );
    EXECUTE format(
      'CREATE POLICY owner_delete ON public.%I FOR DELETE USING (owner_id = auth.uid());',
      target_table
    );
  END LOOP;
END $$;
