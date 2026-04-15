-- Sync cursor v2 (phase 1): add sync_version columns and sequences.
-- This migration is intentionally lightweight (no backfill / trigger / index yet).

CREATE SEQUENCE IF NOT EXISTS public.presets_sync_version_seq;
CREATE SEQUENCE IF NOT EXISTS public.residents_sync_version_seq;
CREATE SEQUENCE IF NOT EXISTS public.relations_sync_version_seq;
CREATE SEQUENCE IF NOT EXISTS public.feelings_sync_version_seq;
CREATE SEQUENCE IF NOT EXISTS public.nicknames_sync_version_seq;
CREATE SEQUENCE IF NOT EXISTS public.events_sync_version_seq;
CREATE SEQUENCE IF NOT EXISTS public.consult_answers_sync_version_seq;
CREATE SEQUENCE IF NOT EXISTS public.world_states_sync_version_seq;
CREATE SEQUENCE IF NOT EXISTS public.player_profiles_sync_version_seq;

ALTER TABLE public.presets ADD COLUMN IF NOT EXISTS sync_version BIGINT;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS sync_version BIGINT;
ALTER TABLE public.relations ADD COLUMN IF NOT EXISTS sync_version BIGINT;
ALTER TABLE public.feelings ADD COLUMN IF NOT EXISTS sync_version BIGINT;
ALTER TABLE public.nicknames ADD COLUMN IF NOT EXISTS sync_version BIGINT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS sync_version BIGINT;
ALTER TABLE public.consult_answers ADD COLUMN IF NOT EXISTS sync_version BIGINT;
ALTER TABLE public.world_states ADD COLUMN IF NOT EXISTS sync_version BIGINT;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS sync_version BIGINT;
