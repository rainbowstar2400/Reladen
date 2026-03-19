-- Phase 5: D-3 ニックネーム自動生成用スキーマ変更

-- residents に nickname_tendency カラム追加
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nickname_tendency_enum') THEN
    CREATE TYPE nickname_tendency_enum AS ENUM ('nickname', 'bare', 'san', 'kun_chan', 'hierarchy');
  END IF;
END $$;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS nickname_tendency nickname_tendency_enum DEFAULT 'san';

-- nicknames に locked カラム追加
ALTER TABLE nicknames ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;
