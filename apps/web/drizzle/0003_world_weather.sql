-- Create world_states table for weather feature
CREATE TABLE IF NOT EXISTS "world_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "weather_current" jsonb NOT NULL,
  "weather_quiet_hours" jsonb NOT NULL,
  "weather_comment" jsonb,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted" boolean NOT NULL DEFAULT false,
  "owner_id" uuid
);

CREATE INDEX IF NOT EXISTS "world_states_updated_idx" ON "world_states" ("updated_at");
