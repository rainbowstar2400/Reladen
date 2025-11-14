DO $$ BEGIN
 CREATE TYPE "public"."feeling_label" AS ENUM('none', 'dislike', 'curious', 'maybe_like', 'like', 'love', 'awkward');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."preset_category" AS ENUM('speech', 'occupation', 'first_person');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."relation_type" AS ENUM('none', 'friend', 'best_friend', 'lover', 'family');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "beliefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"world_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"person_knowledge" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feelings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"label" "feeling_label" DEFAULT 'none' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nicknames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"linked_event_id" uuid NOT NULL,
	"thread_id" uuid,
	"participants" jsonb,
	"snippet" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "preset_category" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_managed" boolean DEFAULT false NOT NULL,
	"owner_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"a_id" uuid NOT NULL,
	"b_id" uuid NOT NULL,
	"type" "relation_type" DEFAULT 'none' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "residents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mbti" text,
	"traits" jsonb,
	"speech_preset" uuid,
	"gender" text,
	"age" integer,
	"birthday" text,
	"occupation" uuid,
	"first_person" uuid,
	"interests" jsonb,
	"sleep_profile" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"owner_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topic_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text,
	"participants" jsonb NOT NULL,
	"status" text DEFAULT 'ongoing' NOT NULL,
	"last_event_id" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "residents" ADD CONSTRAINT "residents_speech_preset_presets_id_fk" FOREIGN KEY ("speech_preset") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "residents" ADD CONSTRAINT "residents_occupation_presets_id_fk" FOREIGN KEY ("occupation") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "residents" ADD CONSTRAINT "residents_first_person_presets_id_fk" FOREIGN KEY ("first_person") REFERENCES "public"."presets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "beliefs_resident_idx" ON "beliefs" ("resident_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "beliefs_updated_idx" ON "beliefs" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_kind_idx" ON "events" ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_updated_idx" ON "events" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_occurred_idx" ON "notifications" ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_updated_idx" ON "notifications" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "presets_category_idx" ON "presets" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topic_threads_status_idx" ON "topic_threads" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topic_threads_updated_idx" ON "topic_threads" ("updated_at");