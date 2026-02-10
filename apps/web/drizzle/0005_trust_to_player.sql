ALTER TABLE "residents"
ADD COLUMN IF NOT EXISTS "trust_to_player" integer DEFAULT 50 NOT NULL;
--> statement-breakpoint
UPDATE "residents"
SET "trust_to_player" = 50
WHERE "trust_to_player" IS NULL;
