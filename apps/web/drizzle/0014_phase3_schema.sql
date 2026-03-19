-- Phase 3 Step 1: スキーマ整理
-- C-1: 旧テーブル削除
DROP TABLE IF EXISTS resident_experiences;
DROP TABLE IF EXISTS experience_events;
DROP TYPE IF EXISTS hook_intent;
DROP TYPE IF EXISTS experience_awareness;
DROP TYPE IF EXISTS experience_source_type;

-- E-4: consult_answers テーブル追加
CREATE TABLE IF NOT EXISTS consult_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,
  selected_choice_id TEXT,
  decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id UUID
);

-- F-3: 家族種別フィールド追加
ALTER TABLE relations ADD COLUMN IF NOT EXISTS family_sub_type TEXT;
