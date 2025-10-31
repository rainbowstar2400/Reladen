# Reladen

Reladen は Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui を核にしたオフライン対応 PWA です。ローカル (IndexedDB / Tauri の app.db) と Supabase(Postgres) を同一スキーマで扱い、`updated_at` と `deleted` のトゥームストーンによる双方向同期を想定しています。

## セットアップ手順

1. **依存関係の導入**
   ```bash
   pnpm install
   ```
2. **環境変数を設定**
   `.env.example` をコピーして `.env` を作成し、各値を入力します。
3. **Web アプリの起動**
   ```bash
   pnpm dev
   ```
   ブラウザで `http://localhost:3000` を開くとダッシュボードが表示されます。
4. **データベースのマイグレーション**
   Drizzle → Supabase へのスキーマ反映。
   ```bash
   pnpm db:push
   ```
5. **ダミーデータ投入 (Supabase)**
   Service Role キーを設定した上で：
   ```bash
   pnpm seed
   ```
6. **デスクトップ版 (Tauri)**
   ```bash
   pnpm tauri:build
   ```
   初回は Rust toolchain が必要です。ビルド時に `apps/desktop/src-tauri/src/main.rs` が `app.db` を `appData` 配下へ作成します。

## プロジェクト構成

```
/apps/web        # Next.js (App Router)
  /app           # 画面・API (sync, seed)
  /components    # shadcn/ui ベースの UI
  /lib           # ローカル/クラウドDB、同期、Drizzle スキーマ
  /scripts       # Supabase シードスクリプト
  sentry.*.ts    # Sentry 初期化
/apps/desktop    # Tauri 設定 (Rust)
/packages/shared/types # Zod + 型共有
```

## 同期の流れ

- `useSync()` がネットワーク状態を監視し、オンライン時に `/app/api/sync/{table}` へローカル差分を送信。
- API 側で `updated_at` の新しい方を採用し、クラウド差分を返却。
- Supabase Realtime (購読) でクラウド側変更を即反映。
- Tombstone (`deleted=true`) を尊重し、削除済みデータは復活しません。
- Tauri 環境では `app.db` に JSON 形式で保存、ブラウザでは IndexedDB を利用します。

## UI 機能概要

- ホーム (発生中の会話・イベントや住人の状況の確認)
- 管理室 (住人情報の確認・編集・追加)
- 日報 (過去の会話ログを閲覧)
- 設定 
- 右上に同期ステータス (online/offline/syncing/error)
- ダークモード切り替え、Framer Motion による軽微なアニメーション

## Drizzle スキーマ

`apps/web/lib/drizzle/schema.ts` を参照してください。共通カラム：
- `id UUID`
- `updated_at TIMESTAMPTZ`
- `deleted BOOLEAN`
- `owner_id UUID (RLS 用)`

テーブル固有カラムは README 冒頭の仕様と同じです。

## Supabase RLS ポリシー例

1. テーブルに `owner_id UUID` を追加済み (NULL 許容)。
2. 匿名ユーザーを許可する場合でも、ログインユーザーだけが自身の行を操作できるように以下のポリシーを参考にしてください。

```sql
-- RLS を ON
alter table residents enable row level security;

-- 行の挿入時に owner_id を自動付与
create policy "residents_insert_own" on residents
  for insert with check (auth.uid() = owner_id);

create policy "residents_select_own" on residents
  for select using (auth.uid() = owner_id);

create policy "residents_update_own" on residents
  for update using (auth.uid() = owner_id);

create policy "residents_delete_own" on residents
  for delete using (auth.uid() = owner_id);
```

他テーブルでも `owner_id` 列を同様に扱い、`auth.uid()` と突き合わせてください。

## Sentry

`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` を設定すると `sentry.client.config.ts` / `sentry.server.config.ts` が初期化します。`tracesSampleRate` は 0.1 に設定済みなので、必要に応じて変更してください。

## PWA

- `next-pwa` で Service Worker を自動生成。
- `public/manifest.json` で基本設定済み。
- オフライン時も直近の画面が保持されるようにキャッシュします。

## よくあるエラーと対処

| 症状 | 原因 | 対処 |
| ---- | ---- | ---- |
| `SupabaseのURLまたはService Roleキーが設定されていません` | `.env` 未設定 | `.env` に `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を記入 |
| `sync {table} failed` | API へのアクセス失敗 | ブラウザコンソールでネットワーク状況を確認。`pnpm dev` が起動中か確認 |
| Tauri ビルドで Rust エラー | Rust toolchain 未インストール | `rustup` を入れ、`cargo --version` が通ることを確認 |
| IndexedDB の読み書きができない | ブラウザのプライベートモード | 通常モードまたは別ブラウザで再度アクセス |

## データ移行の入口

- Drizzle のマイグレーションは `drizzle.config.ts` に設定済みです。
- 追加のカラムやテーブルが必要な場合は `apps/web/lib/drizzle/schema.ts` を編集し、`pnpm db:push` で反映してください。
- ローカル DB (IndexedDB/Tauri) のマイグレーションはコード上で扱っている JSON/ストア構造を拡張してください。

## テスト

- `pnpm --filter web test` で `vitest` が実行されます (サービス層の単体テスト用の雛形)。

## 参考リンク

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [TanStack Query](https://tanstack.com/query/latest)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Supabase](https://supabase.com/)
- [Tauri](https://tauri.app/)
