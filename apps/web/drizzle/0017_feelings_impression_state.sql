-- Phase 6: S4-03 feelings の印象3層（base/special/base_before_special）保存

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feeling_base_label') THEN
    CREATE TYPE feeling_base_label AS ENUM (
      'dislike',
      'maybe_dislike',
      'none',
      'curious',
      'maybe_like',
      'like',
      'love'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feeling_special_label') THEN
    CREATE TYPE feeling_special_label AS ENUM ('awkward');
  END IF;
END $$;

ALTER TABLE feelings ADD COLUMN IF NOT EXISTS base_label feeling_base_label;
ALTER TABLE feelings ADD COLUMN IF NOT EXISTS special_label feeling_special_label;
ALTER TABLE feelings ADD COLUMN IF NOT EXISTS base_before_special feeling_base_label;

-- 既存データを補完
-- 1) base_label: awkward 以外は label をそのまま採用、awkward は none を初期値にする
UPDATE feelings
SET base_label = CASE
  WHEN label IN ('dislike', 'maybe_dislike', 'none', 'curious', 'maybe_like', 'like', 'love')
    THEN label::feeling_base_label
  ELSE 'none'::feeling_base_label
END
WHERE base_label IS NULL;

-- 2) special_label: label=awkward の行のみ設定
UPDATE feelings
SET special_label = 'awkward'::feeling_special_label
WHERE label = 'awkward' AND special_label IS NULL;

-- 3) base_before_special: 既存 awkward 行は復元情報がないため、暫定で base_label を格納
UPDATE feelings
SET base_before_special = base_label
WHERE label = 'awkward' AND base_before_special IS NULL;

ALTER TABLE feelings ALTER COLUMN base_label SET NOT NULL;
ALTER TABLE feelings ALTER COLUMN base_label SET DEFAULT 'none'::feeling_base_label;
