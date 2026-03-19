-- Phase 4 Step 3: 時間経過バッチ用スキーマ
-- A-6: 好感度自然減少、B-1: 印象時間回帰、B-4: awkward時間回復

-- feelings に最終接触日時を追加
ALTER TABLE feelings ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;

-- 既存データは updated_at で初期化
UPDATE feelings SET last_contacted_at = updated_at WHERE last_contacted_at IS NULL;
