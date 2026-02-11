ALTER TABLE "beliefs" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "beliefs_owner_idx" ON "beliefs" ("owner_id");
--> statement-breakpoint
UPDATE "beliefs" AS b
SET "owner_id" = r."owner_id"
FROM "residents" AS r
WHERE b."resident_id" = r."id"
  AND b."owner_id" IS NULL
  AND r."owner_id" IS NOT NULL;
