# AGENT.md

Reladen リポジトリで作業するエージェント向けの短い手引きです。

## プロジェクト概要
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui の PWA。オフライン (IndexedDB) / Tauri (app.db) と Supabase を tombstone (`deleted` / `updated_at`) 付きで双方向同期。
- ドメイン: 住人・会話イベントのログを扱い、好感度や印象を簡易集計。会話評価ロジックは `apps/web/lib/evaluation` 周辺。
- 生成系: GPT 出力を利用。重みは `public/config/conversation-weights.json` と `apps/web/lib/evaluation/weights.ts` を参照。

## ディレクトリと型
- `apps/web/app`: 画面と API (`/api/sync` など)。
- `apps/web/lib`: DB/同期/永続化ロジック。会話保存は `lib/persist/persist-conversation.ts`。
- `packages/shared/types`: Zod + 共有型。API/DB の型はここから利用・追加する。
- `public/manifest.json`, `sentry.*`: PWA と Sentry 設定。
- `apps/desktop`: Tauri 用。Rust 側で `app.db` を配置。

## 開発コマンド (pnpm)
- 依存導入: `pnpm install`。Web 開発: `pnpm dev`。
- Lint/format: `pnpm lint` (`next lint`)。Prettier 設定あり。
- テスト: `pnpm test` (web フィルタで vitest)。
- DB: `pnpm db:push` (Drizzle→Supabase)。`pnpm seed` / `pnpm seed:min` でダミーデータ投入。
- Tauri: `pnpm tauri:dev` / `pnpm tauri:build` (Rust toolchain 必須)。

## 実装上の注意
- Tombstone 同期: すべてのテーブルで `updated_at` と `deleted` を尊重し、削除済みを復活させない。
- オフライン対応: IndexedDB/Tauri KV (`apps/web/lib/db/kv-*`) を壊さない。API 同期フロー `useSync` → `/app/api/sync` を意識。
- 型・バリデーション: 共有型/Zod を追加・流用する。`@/` は `apps/web`、`@repo/shared` は `packages/shared` を指す。
- 会話永続化: `persist-conversation.ts` の関係/印象更新は簡易実装。実ロジックがあれば差し替え可だがフィールド構造は維持。
- Secrets: `.env` は手動で用意。鍵や URL をハードコードしない。

## 変更提案の指針
- 仕様に迷う場合は README の同期/DB 方針を優先し、UI は shadcn/ui + Tailwind の既存パターンに合わせる。
- 大きな変更前には関連テーブルと API を確認し、`packages/shared/types` を更新してから Web/Tauri 双方に波及させる。
