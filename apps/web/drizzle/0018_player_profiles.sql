-- player_profiles テーブル: プレイヤー名・プラポリ同意・オンボーディング完了を管理

CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  privacy_accepted_at TIMESTAMPTZ,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID
);

CREATE INDEX IF NOT EXISTS player_profiles_owner_idx ON player_profiles (owner_id);
