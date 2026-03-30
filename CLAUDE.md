# Reladen — CLAUDE.md

## プロジェクト概要

Reladen は、AI キャラクター（住人）たちが自律的に会話・感情・関係を発展させるライフシミュレーションゲーム。プレイヤーは傍観者 / 相談役として関与し、直接操作はしない。

## 技術スタック

| 領域 | 技術 |
|---|---|
| フロントエンド | Next.js 14 (App Router) + React 18 + TypeScript 5 |
| スタイル | Tailwind CSS + shadcn/ui (Radix UI) + Framer Motion |
| バックエンド | Supabase (PostgreSQL + Auth) |
| ORM | Drizzle ORM |
| 状態管理 | TanStack React Query |
| LLM | OpenAI GPT-5.1 (会話生成) / gpt-5-mini (補助) |
| ローカルDB | IndexedDB (idb) / Tauri KV (desktop) |
| デスクトップ | Tauri (Rust) |
| ホスティング | Vercel |
| テスト | Vitest |
| モノレポ | pnpm workspaces + Turbo |

## ディレクトリ構成

```
/apps
  /web          # Next.js メインアプリ
    /app        # App Router ページ・APIルート
      /(dashboard)  # ホーム・オフィス・レポート・設定等
      /api          # APIルート (conversations, consults, sync, batch)
    /components # UIコンポーネント
    /lib
      /drizzle  # schema.ts・DB接続
      /db       # IndexedDB / KV ストア
      /services # ビジネスロジックサービス
      /hooks    # カスタムフック
    /drizzle    # マイグレーションファイル (0000〜)
  /desktop      # Tauri デスクトップアプリ
/packages
  /shared
    /types      # Zod + TypeScript 型定義
    /logic      # 純粋ビジネスロジック
    /gpt        # GPT ユーティリティ
/documents
  /spec         # 仕様書 (00〜09)
  /memo         # 設計メモ
/scripts        # DBシードスクリプト
```

## よく使うコマンド

```bash
pnpm dev              # 開発サーバー起動
pnpm build            # ビルド
pnpm test             # テスト実行 (Vitest)
pnpm lint             # ESLint
pnpm db:push          # Drizzle スキーマを DB に反映
pnpm db:generate      # マイグレーションファイル生成
pnpm db:studio        # Drizzle Studio 起動
pnpm seed:min         # 最小シードデータ投入
pnpm tauri:dev        # デスクトップアプリ開発
```

## ドメイン知識

### 住人 (Resident)
- MBTI・5軸性格パラメータ・話し方プリセット・職業・一人称を持つ
- `trustToPlayer`: プレイヤーへの信頼度 (0〜100)
- 睡眠プロファイルにより活動時間が決まる

### 関係 (Relation) — 対称
- テーブル: `relations` (aId, bId のペア)
- 種別: `none` → `acquaintance` → `friend` → `best_friend` → `lover` / `family`

### 感情 (Feeling) — 非対称
- テーブル: `feelings` (fromId → toId)
- `favor`: 好感度スコア
- `impressionLabel`: 現在の印象ラベル (none / dislike / maybe_dislike / curious / maybe_like / like / love / awkward)
- `impressionBase` / `impressionSpecial`: ベース印象と特殊印象
- `recentDelta`: 最近の好感度変化量

### 会話パイプライン
1. スケジューリング (15分インターバル / 目標1時間サーバーサイド)
2. 話題選定 (9種ソース)
3. 会話構造決定
4. LLM 生成 (GPT-5.1)
5. バリデーション
6. 感情評価 (gpt-5-mini)
7. DB 永続化

### 同期戦略
- ローカル優先 (IndexedDB / Tauri KV)
- トゥームストーン方式: `deleted=true` で論理削除
- `updated_at` で競合解決 (新しい方が勝つ)
- `/api/sync/[table]` で双方向同期

## DBスキーマの共通パターン

すべての主要テーブルは以下を持つ:
- `id`: UUID (primaryKey)
- `updated_at`: timestamp with timezone
- `deleted`: boolean (トゥームストーン)
- `owner_id`: UUID (Supabase RLS 用)

## 実装ガイドライン

- **型安全**: Zod でスキーマ定義 → TypeScript 型を導出する。`any` は使わない
- **DRY**: 同じロジックは `packages/shared/logic` または `lib/services` に切り出す
- **オフラインファースト**: UI ロジックは IndexedDB を主ソースとして扱い、Supabase は同期先
- **LLM コスト**: 補助タスクは gpt-5-mini、主要生成のみ GPT-5.1 を使う
- **RLS**: Supabase の全テーブルに `owner_id = auth.uid()` ポリシーが適用される。バイパスしない
- **マイグレーション**: スキーマ変更は `drizzle-kit generate` → `drizzle-kit push` の順。直接 SQL 編集しない
- **テスト**: ビジネスロジックの変更には Vitest テストを書く。モックより実 DB を優先

## コミット・PRルール

- コミットメッセージ・PRタイトル・本文は**日本語**で書く
- フォーマット: `<type>: <概要>` (例: `feat: 住人の誕生日表示を追加`)

## 仕様書

詳細は `/documents/spec/` を参照:
- `01` ゲームコンセプト・設計原則
- `02` キャラクター定義系
- `03` 関係・感情系
- `04` 会話生成系
- `05` 世界シミュレーション系
- `06` プレイヤー介入・インフラ系
- `07` UI・画面設計
