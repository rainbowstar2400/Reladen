CREATE TABLE IF NOT EXISTS "shared_snippets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "participant_a" uuid NOT NULL,
  "participant_b" uuid NOT NULL,
  "text" text NOT NULL,
  "source" text NOT NULL DEFAULT 'coincidence',
  "occurred_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted" boolean NOT NULL DEFAULT false,
  "owner_id" uuid
);
