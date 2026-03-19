ALTER TABLE "feelings" ADD COLUMN "recent_deltas" jsonb NOT NULL DEFAULT '[]'::jsonb;
