-- Sync cursor v2 (phase 2):
-- 1) backfill sync_version for existing rows
-- 2) safely advance sequence even on empty tables
-- 3) enable trigger/default for INSERT+UPDATE auto-increment
-- 4) add owner_id + sync_version index for RLS-friendly pulls

-- ---------------------------------------------------------------------------
-- presets
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.presets
),
ranked AS (
  SELECT
    p.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY p.updated_at, p.id) AS next_version
  FROM public.presets p
  WHERE p.sync_version IS NULL
)
UPDATE public.presets p
SET sync_version = ranked.next_version
FROM ranked
WHERE p.id = ranked.id;

SELECT setval(
  'public.presets_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.presets), 1),
  (SELECT COUNT(*) > 0 FROM public.presets)
);

ALTER TABLE public.presets
  ALTER COLUMN sync_version SET DEFAULT nextval('public.presets_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.presets_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.presets_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_presets_sync_version ON public.presets;
CREATE TRIGGER trg_presets_sync_version
BEFORE INSERT OR UPDATE ON public.presets
FOR EACH ROW
EXECUTE FUNCTION public.presets_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_presets_owner_sync_version
  ON public.presets (owner_id, sync_version);

-- ---------------------------------------------------------------------------
-- residents
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.residents
),
ranked AS (
  SELECT
    r.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY r.updated_at, r.id) AS next_version
  FROM public.residents r
  WHERE r.sync_version IS NULL
)
UPDATE public.residents r
SET sync_version = ranked.next_version
FROM ranked
WHERE r.id = ranked.id;

SELECT setval(
  'public.residents_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.residents), 1),
  (SELECT COUNT(*) > 0 FROM public.residents)
);

ALTER TABLE public.residents
  ALTER COLUMN sync_version SET DEFAULT nextval('public.residents_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.residents_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.residents_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_residents_sync_version ON public.residents;
CREATE TRIGGER trg_residents_sync_version
BEFORE INSERT OR UPDATE ON public.residents
FOR EACH ROW
EXECUTE FUNCTION public.residents_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_residents_owner_sync_version
  ON public.residents (owner_id, sync_version);

-- ---------------------------------------------------------------------------
-- relations
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.relations
),
ranked AS (
  SELECT
    r.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY r.updated_at, r.id) AS next_version
  FROM public.relations r
  WHERE r.sync_version IS NULL
)
UPDATE public.relations r
SET sync_version = ranked.next_version
FROM ranked
WHERE r.id = ranked.id;

SELECT setval(
  'public.relations_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.relations), 1),
  (SELECT COUNT(*) > 0 FROM public.relations)
);

ALTER TABLE public.relations
  ALTER COLUMN sync_version SET DEFAULT nextval('public.relations_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.relations_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.relations_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relations_sync_version ON public.relations;
CREATE TRIGGER trg_relations_sync_version
BEFORE INSERT OR UPDATE ON public.relations
FOR EACH ROW
EXECUTE FUNCTION public.relations_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_relations_owner_sync_version
  ON public.relations (owner_id, sync_version);

-- ---------------------------------------------------------------------------
-- feelings
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.feelings
),
ranked AS (
  SELECT
    f.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY f.updated_at, f.id) AS next_version
  FROM public.feelings f
  WHERE f.sync_version IS NULL
)
UPDATE public.feelings f
SET sync_version = ranked.next_version
FROM ranked
WHERE f.id = ranked.id;

SELECT setval(
  'public.feelings_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.feelings), 1),
  (SELECT COUNT(*) > 0 FROM public.feelings)
);

ALTER TABLE public.feelings
  ALTER COLUMN sync_version SET DEFAULT nextval('public.feelings_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.feelings_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.feelings_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feelings_sync_version ON public.feelings;
CREATE TRIGGER trg_feelings_sync_version
BEFORE INSERT OR UPDATE ON public.feelings
FOR EACH ROW
EXECUTE FUNCTION public.feelings_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_feelings_owner_sync_version
  ON public.feelings (owner_id, sync_version);

-- ---------------------------------------------------------------------------
-- nicknames
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.nicknames
),
ranked AS (
  SELECT
    n.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY n.updated_at, n.id) AS next_version
  FROM public.nicknames n
  WHERE n.sync_version IS NULL
)
UPDATE public.nicknames n
SET sync_version = ranked.next_version
FROM ranked
WHERE n.id = ranked.id;

SELECT setval(
  'public.nicknames_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.nicknames), 1),
  (SELECT COUNT(*) > 0 FROM public.nicknames)
);

ALTER TABLE public.nicknames
  ALTER COLUMN sync_version SET DEFAULT nextval('public.nicknames_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.nicknames_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.nicknames_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nicknames_sync_version ON public.nicknames;
CREATE TRIGGER trg_nicknames_sync_version
BEFORE INSERT OR UPDATE ON public.nicknames
FOR EACH ROW
EXECUTE FUNCTION public.nicknames_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_nicknames_owner_sync_version
  ON public.nicknames (owner_id, sync_version);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.events
),
ranked AS (
  SELECT
    e.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY e.updated_at, e.id) AS next_version
  FROM public.events e
  WHERE e.sync_version IS NULL
)
UPDATE public.events e
SET sync_version = ranked.next_version
FROM ranked
WHERE e.id = ranked.id;

SELECT setval(
  'public.events_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.events), 1),
  (SELECT COUNT(*) > 0 FROM public.events)
);

ALTER TABLE public.events
  ALTER COLUMN sync_version SET DEFAULT nextval('public.events_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.events_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.events_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_sync_version ON public.events;
CREATE TRIGGER trg_events_sync_version
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.events_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_events_owner_sync_version
  ON public.events (owner_id, sync_version);

-- ---------------------------------------------------------------------------
-- consult_answers
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.consult_answers
),
ranked AS (
  SELECT
    c.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY c.updated_at, c.id) AS next_version
  FROM public.consult_answers c
  WHERE c.sync_version IS NULL
)
UPDATE public.consult_answers c
SET sync_version = ranked.next_version
FROM ranked
WHERE c.id = ranked.id;

SELECT setval(
  'public.consult_answers_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.consult_answers), 1),
  (SELECT COUNT(*) > 0 FROM public.consult_answers)
);

ALTER TABLE public.consult_answers
  ALTER COLUMN sync_version SET DEFAULT nextval('public.consult_answers_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.consult_answers_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.consult_answers_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consult_answers_sync_version ON public.consult_answers;
CREATE TRIGGER trg_consult_answers_sync_version
BEFORE INSERT OR UPDATE ON public.consult_answers
FOR EACH ROW
EXECUTE FUNCTION public.consult_answers_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_consult_answers_owner_sync_version
  ON public.consult_answers (owner_id, sync_version);

-- ---------------------------------------------------------------------------
-- world_states
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.world_states
),
ranked AS (
  SELECT
    w.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY w.updated_at, w.id) AS next_version
  FROM public.world_states w
  WHERE w.sync_version IS NULL
)
UPDATE public.world_states w
SET sync_version = ranked.next_version
FROM ranked
WHERE w.id = ranked.id;

SELECT setval(
  'public.world_states_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.world_states), 1),
  (SELECT COUNT(*) > 0 FROM public.world_states)
);

ALTER TABLE public.world_states
  ALTER COLUMN sync_version SET DEFAULT nextval('public.world_states_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.world_states_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.world_states_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_world_states_sync_version ON public.world_states;
CREATE TRIGGER trg_world_states_sync_version
BEFORE INSERT OR UPDATE ON public.world_states
FOR EACH ROW
EXECUTE FUNCTION public.world_states_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_world_states_owner_sync_version
  ON public.world_states (owner_id, sync_version);

-- ---------------------------------------------------------------------------
-- player_profiles
-- ---------------------------------------------------------------------------
WITH base AS (
  SELECT COALESCE(MAX(sync_version), 0) AS max_version
  FROM public.player_profiles
),
ranked AS (
  SELECT
    p.id,
    (SELECT max_version FROM base) + row_number() OVER (ORDER BY p.updated_at, p.id) AS next_version
  FROM public.player_profiles p
  WHERE p.sync_version IS NULL
)
UPDATE public.player_profiles p
SET sync_version = ranked.next_version
FROM ranked
WHERE p.id = ranked.id;

SELECT setval(
  'public.player_profiles_sync_version_seq',
  COALESCE((SELECT MAX(sync_version) FROM public.player_profiles), 1),
  (SELECT COUNT(*) > 0 FROM public.player_profiles)
);

ALTER TABLE public.player_profiles
  ALTER COLUMN sync_version SET DEFAULT nextval('public.player_profiles_sync_version_seq'),
  ALTER COLUMN sync_version SET NOT NULL;

CREATE OR REPLACE FUNCTION public.player_profiles_set_sync_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sync_version := nextval('public.player_profiles_sync_version_seq');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_player_profiles_sync_version ON public.player_profiles;
CREATE TRIGGER trg_player_profiles_sync_version
BEFORE INSERT OR UPDATE ON public.player_profiles
FOR EACH ROW
EXECUTE FUNCTION public.player_profiles_set_sync_version();

CREATE INDEX IF NOT EXISTS idx_player_profiles_owner_sync_version
  ON public.player_profiles (owner_id, sync_version);
