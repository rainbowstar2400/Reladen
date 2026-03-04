CREATE TABLE IF NOT EXISTS "recent_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "character_id" uuid NOT NULL,
  "fact" text NOT NULL,
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "shared_with" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted" boolean NOT NULL DEFAULT false,
  "owner_id" uuid
);

CREATE TABLE IF NOT EXISTS "offscreen_knowledge" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "learned_by" uuid NOT NULL,
  "about" uuid NOT NULL,
  "fact" text NOT NULL,
  "source" text NOT NULL DEFAULT 'offscreen',
  "learned_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted" boolean NOT NULL DEFAULT false,
  "owner_id" uuid
);
