CREATE TABLE IF NOT EXISTS "world_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weather_current" jsonb NOT NULL,
	"weather_quiet_hours" jsonb NOT NULL,
	"weather_comment" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "world_states_updated_idx" ON "world_states" ("updated_at");