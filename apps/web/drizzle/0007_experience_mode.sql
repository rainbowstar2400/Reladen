DO $$ BEGIN
  CREATE TYPE "experience_source_type" AS ENUM ('lifestyle', 'work', 'interpersonal', 'environment');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "experience_awareness" AS ENUM ('direct', 'witnessed', 'heard');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "hook_intent" AS ENUM ('invite', 'share', 'complain', 'consult', 'reflect');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experience_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL,
  "source_type" "experience_source_type" NOT NULL,
  "source_ref" text,
  "fact_summary" text NOT NULL,
  "fact_detail" jsonb,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "significance" integer NOT NULL DEFAULT 0,
  "signature" text NOT NULL,
  "occurred_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted" boolean NOT NULL DEFAULT false,
  CONSTRAINT "experience_events_significance_range_chk" CHECK ("significance" >= 0 AND "significance" <= 100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resident_experiences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" uuid NOT NULL,
  "experience_id" uuid NOT NULL REFERENCES "experience_events"("id") ON DELETE CASCADE,
  "resident_id" uuid NOT NULL,
  "awareness" "experience_awareness" NOT NULL,
  "appraisal" text NOT NULL,
  "hook_intent" "hook_intent" NOT NULL,
  "confidence" integer NOT NULL DEFAULT 0,
  "salience" integer NOT NULL DEFAULT 0,
  "learned_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted" boolean NOT NULL DEFAULT false,
  CONSTRAINT "resident_experiences_confidence_range_chk" CHECK ("confidence" >= 0 AND "confidence" <= 100),
  CONSTRAINT "resident_experiences_salience_range_chk" CHECK ("salience" >= 0 AND "salience" <= 100)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experience_events_owner_occurred_idx"
  ON "experience_events" ("owner_id", "occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "experience_events_owner_signature_occurred_idx"
  ON "experience_events" ("owner_id", "signature", "occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resident_experiences_owner_resident_salience_learned_idx"
  ON "resident_experiences" ("owner_id", "resident_id", "salience" DESC, "learned_at" DESC);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resident_experiences_owner_experience_resident_uniq"
  ON "resident_experiences" ("owner_id", "experience_id", "resident_id");
