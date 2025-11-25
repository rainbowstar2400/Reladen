ALTER TYPE "feeling_label" ADD VALUE 'maybe_dislike';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "presets" ADD COLUMN "example" text;--> statement-breakpoint
ALTER TABLE "beliefs" DROP COLUMN IF EXISTS "owner_id";