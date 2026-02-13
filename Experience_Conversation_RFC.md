# Reladen 会話再設計 RFC（Experience中心）

- Status: Draft (実装着手可能)
- Last Updated: 2026-02-13
- Audience: `apps/web`, `packages/shared`, `db/migration` の実装担当

## 概要
本 RFC は、会話品質課題を「スケジューラ」ではなく「会話内容の世界接地不足」と定義し、`Belief/WorldFact` 中心設計を `Experience` 中心設計へ移す。  
最終目的は「住人が現実にいたら言いそうな会話」を、世界の出来事と住人ごとの知覚差から安定生成すること。

本書は仕様固定文書であり、実装判断を最小化する。

## 背景と問題定義
1. 会話は発火できているが、内容が汎用世間話に収束しやすい。
2. 「Reladen 世界で実際に起きた出来事」が会話入力に十分流入していない。
3. 既存 `events` は主にアプリログ（表示・同期）であり、住人の体験事実の正規ソースとしては粒度が粗い。
4. 住人の「体験」と「プレイヤーの観測」を同一レイヤーで扱うと、会話自然性とネタバレ制御が競合する。

### 現状フロー（問題点つき）
1. スケジューラが会話を発火。
2. 直近会話・関係・感情を主に参照して LLM 生成。
3. 生成後評価でタグ/知識更新。
4. 結果: 会話継続性はあるが、世界出来事との結びつきが弱い。

## 設計原則
1. 会話の核は `Experience = Fact + Appraisal + Hook` とする。
2. `Fact` のみは会話アンカーとして弱い。`Appraisal`（どう感じたか）を必須にする。
3. 「どこへ行った」「誰かを見た」単体イベントも許可するが、`Appraisal` が無い候補は棄却する。
4. 会話への出来事参照は必須化しない。運用目標（接地率）で品質を管理する。
5. プレイヤー未観測の出来事も世界事実として生成・保持する。
6. スケジューラは現行ロジックを維持し、会話内容生成層のみ刷新する。

### 用語定義
- Fact: 客観的に「何が起きたか」
- Appraisal: 当人がどう受け取ったか（感情/解釈）
- Hook: 次の会話に接続する意図（誘う、共有する、愚痴る、相談する等）
- World Fact Layer: `experience_events`
- Resident Perception Layer: `resident_experiences`
- Player Observation Layer: 既存 UI/ログ向け表示層

## 目標指標（KPI）
1. 体験出来事に接地した会話比率: 70%以上（24時間移動平均）。
2. 同一ペア同型話題連投率: 15%未満（直近30会話基準）。
3. 高変動プロファイル運用時でも静穏時間を許容（常時イベント生成しない）。

### 指標定義
- Grounded Conversation:
  `meta.grounded = true` かつ `meta.anchorExperienceId` が存在し、本文に証拠語が1件以上ある会話。
- 同型話題:
  `pair + anchor.signature` がクールダウン期間内で重複した会話。

## データモデル
1. `experience_events` を新設する。
2. `resident_experiences` を新設する。
3. `experience_events` は世界事実を保持する。
4. `resident_experiences` は住人ごとの知覚差を保持する。
5. 必須概念を固定する（Fact/Appraisal/Hook）。
6. `awareness` は `direct | witnessed | heard`。
7. 余波期間（標準TTL）は 1〜3日。

### ER 関係（概念）
1. `experience_events (1) -> (N) resident_experiences`
2. `resident_experiences (N) -> (1) residents`
3. `experience_events.source_ref` は既存テーブル行を任意参照（論理参照）

### `experience_events`（世界事実）
| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | uuid | Yes | 主キー |
| `owner_id` | uuid | Yes | テナント分離 |
| `source_type` | text | Yes | `lifestyle/work/interpersonal/environment` |
| `source_ref` | text | No | 発生元参照（`table:id`） |
| `fact_summary` | text | Yes | 客観要約 |
| `fact_detail` | jsonb | No | 構造化詳細（place, actors, before/after など） |
| `tags` | jsonb | Yes | 検索/集計用タグ配列 |
| `significance` | int | Yes | 0-100 |
| `signature` | text | Yes | 同型判定用 |
| `occurred_at` | timestamptz | Yes | 発生時刻 |
| `updated_at` | timestamptz | Yes | 更新時刻 |
| `deleted` | boolean | Yes | tombstone |

### `resident_experiences`（住人知覚）
| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | uuid | Yes | 主キー |
| `owner_id` | uuid | Yes | テナント分離 |
| `experience_id` | uuid | Yes | FK |
| `resident_id` | uuid | Yes | FK |
| `awareness` | text | Yes | `direct/witnessed/heard` |
| `appraisal` | text | Yes | 感想/受け取り |
| `hook_intent` | text | Yes | `invite/share/complain/consult/reflect` |
| `confidence` | int | Yes | 0-100 |
| `salience` | int | Yes | 0-100 |
| `learned_at` | timestamptz | Yes | 認知時刻 |
| `expires_at` | timestamptz | No | 期限 |
| `updated_at` | timestamptz | Yes | 更新時刻 |
| `deleted` | boolean | Yes | tombstone |

### インデックス/制約（実装必須）
1. `experience_events(owner_id, occurred_at desc)`。
2. `experience_events(owner_id, signature, occurred_at desc)`。
3. `resident_experiences(owner_id, resident_id, salience desc, learned_at desc)`。
4. `resident_experiences(owner_id, experience_id, resident_id)` unique。
5. `significance/confidence/salience` は `0 <= x <= 100` 制約。

## 生成パイプライン
1. 方式はハイブリッド因果モデルを採用する。
2. 生活シミュレーションで行動候補を作る。
3. 因果ルールで出来事候補へ変換する。
4. 初期ドメインは `生活 + 仕事 + 対人 + 環境`。
5. 手動差し込みイベントは実装しない。
6. 候補採用条件を固定する。

### パイプライン詳細
1. `CollectState`: world/residents/relations/feelings/recent conversations を収集。
2. `SimulateActs`: 時間帯・天候・性格・関係性から行動候補を生成。
3. `DeriveEvents`: 行動と状態変化からイベント候補を作る。
4. `Appraise`: 当事者ごとに `appraisal/hook_intent` を付与。
5. `Validate`: 必須条件を満たす候補のみ通す。
6. `DedupeAndCooldown`: 同型署名クールダウンで抑制。
7. `Persist`: `experience_events` と `resident_experiences` を保存。

### 候補採用条件（厳密）
1. `fact_summary` に具体語1件以上（場所、人、対象、事物のいずれか）。
2. `appraisal` が空でない。
3. `hook_intent` が辞書内。
4. `state change(before/after)` がある場合は `significance +10`。
5. `state change` が無い場合は `appraisal_strength + hook_strength >= 閾値` を満たす。

### 初期ドメイン別テンプレート（例）
1. 生活: `外出/買い物/通学/帰宅/休息`
2. 仕事: `勤務中のトラブル/褒賞/負荷増減`
3. 対人: `約束/すれ違い/目撃/噂の受信`
4. 環境: `雨・雷雨・静穏時間・交通影響`

### 「単体イベント」の扱い
1. 許可: 「遊園地に行った」「誰かを見かけた」。
2. 必須: その住人の `appraisal` を必ず付与する。
3. 任意: before/after は推奨だが必須ではない。
4. 会話アンカー採用時は `fact + appraisal + hook` の3点セットが必要。

### 知覚配布・噂伝播
1. 当事者は `direct`。
2. 近傍条件を満たす住人は `witnessed`。
3. それ以外は噂伝播で `heard` を生成する。
4. `heard` は `confidence` を減衰して保存する。

#### 噂伝播確率（初期式）
`p = clamp(0.05 + relation_bonus + salience_bonus + recency_bonus - distance_penalty, 0, 0.45)`

- `relation_bonus`: 関係が近いほど加点
- `salience_bonus`: `salience` が高いほど加点
- `recency_bonus`: 発生から近いほど加点
- `distance_penalty`: 生活圏が離れるほど減点

## 会話生成パイプライン（2段）
1. Step1 で `ConversationBrief` を決定的ロジックで生成する。
2. Step2 で LLM が `ConversationBrief` を本文化する。
3. `ConversationBrief` 必須項目を固定する。
4. 会話後に接地判定を行い、メタ情報として保存する。

### Step1: Brief 生成（決定的）
1. ペア2人に有効な `resident_experiences` を収集。
2. 候補スコアを計算して上位1件をアンカー選定。
3. 候補不足時は `continuation` または `free` へフォールバック。

#### アンカースコア（初期）
`score = 0.35*salience + 0.25*confidence + 0.20*recency + 0.20*novelty`

### Step2: LLM 本文化
1. `ConversationBrief` を第一入力にする。
2. 住人プロフィールと口調情報は補助入力とする。
3. 生成は最大1回リトライ（接地判定NG時）。

### `ConversationBrief` 仕様（確定）
```ts
type ConversationBrief = {
  anchorExperienceId?: string;
  anchorFact: string;
  anchorSignature?: string;
  speakerAppraisal: Array<{ speakerId: string; text: string }>;
  speakerHookIntent: Array<{
    speakerId: string;
    intent: "invite" | "share" | "complain" | "consult" | "reflect";
  }>;
  expressionStyle: "explicit" | "implicit" | "mixed";
  fallbackMode: "experience" | "continuation" | "free";
};
```

### 接地判定（post-generation）
1. `anchorExperienceId` が存在する。
2. 本文中に `anchorFact` の証拠語が1件以上ある。
3. 少なくとも1人の `appraisal` 痕跡がある。
4. `hook_intent` に対応する会話行動がある（誘い/相談/共有など）。

## バリエーション制御
1. 強め抑制を採用する。
2. 同型署名クールダウンを導入する。
3. ドメイン配分をローテーション管理する。
4. 明示的静穏時間を設ける。
5. 高変動プロファイル向けに発生上限と下限を設定する。

### 同型署名
`signature = source_type + primary_actor + primary_target + place(optional) + hook_intent`

### クールダウン（初期値）
1. 同一署名: 36時間
2. 同一 source_type + same pair: 12時間
3. 同一 hook_intent + same pair: 8時間

### 配分制御（高変動）
1. 24時間あたり各ドメイン最低1件を目標（静穏日は除外）。
2. 単一ドメインが50%超なら次候補で減衰。
3. 1時間あたりイベント生成上限を設ける。

### 静穏時間
1. 静穏時間は「イベントが起きない」ことを正常とみなす。
2. 静穏時間中は既存イベントの余波会話のみを優先する。

## 可視性とネタバレ制御
1. プレイヤー未観測出来事も `experience_events` に保持する。
2. 会話では匂わせを許可する。
3. UIのプレイヤー向けログ表示は別制御とする。
4. 世界事実層とプレイヤー観測層を分離する。

### 3層モデル
1. 世界事実層: 実際に起きた出来事（非公開含む）
2. 住人知覚層: 誰が何をどう認識したか
3. プレイヤー表示層: UIで見せる情報（公開ポリシー適用）

### 表示ポリシー（初期）
1. 会話本文: 匂わせ可
2. 日報UI: 既存ログ中心、未観測事実は直接表示しない
3. 管理者向け内部診断（将来）: 世界事実層を閲覧可能

## 既存モデル移行（2フェーズ）
1. Phase1 で `Experience` 主軸を導入し、`Belief/WorldFact` の読取・更新を停止する。
2. Phase2 で `beliefs` 関連スキーマとコードを削除する。
3. スケジューラは変更しない。

### Phase1（導入）タスク
1. `experience_events` / `resident_experiences` migration追加
2. shared types 追加
3. Experience生成器/Brief生成器追加
4. conversation prompt を brief 入力へ切替
5. `runConversation` に brief 生成を挿入
6. `persistConversation` で `meta.anchorExperienceId/grounded` 保存
7. belief 読取/更新の実行停止（コード残置）

### Phase2（削除）タスク
1. `beliefs` テーブル削除 migration
2. `belief-mapper` / `upsert-beliefs` / belief参照削除
3. テスト・型の belief 依存削除
4. README/AGENT.md の設計参照更新

### ロールバック方針
1. Feature Flag で旧モード復帰可能にする。
2. Phase1 中は beliefs スキーマを残置し緊急復帰に備える。

## 公開インターフェース変更
1. `packages/shared/types` に Experience 型を追加。
2. `packages/shared/gpt/prompts/conversation-prompt.ts` の入力を `brief` 依存へ変更。
3. `apps/web/lib/conversation/run-conversation.ts` に brief 生成ステップを追加。
4. `packages/shared/types/conversation.ts` の `meta` に接地項目を optional 追加。

### 追加予定型（概要）
```ts
export type ExperienceEvent = {
  id: string;
  ownerId: string;
  sourceType: "lifestyle" | "work" | "interpersonal" | "environment";
  factSummary: string;
  significance: number;
  signature: string;
  occurredAt: string;
};

export type ResidentExperience = {
  id: string;
  experienceId: string;
  residentId: string;
  awareness: "direct" | "witnessed" | "heard";
  appraisal: string;
  hookIntent: "invite" | "share" | "complain" | "consult" | "reflect";
  confidence: number;
  salience: number;
};
```

### `conversation.meta` 追加項目（optional）
- `anchorExperienceId?: string`
- `grounded?: boolean`
- `groundingEvidence?: string[]`
- `fallbackMode?: "experience" | "continuation" | "free"`

## テスト計画
1. Experience生成ユニットテスト
2. 噂伝播ユニットテスト
3. Brief生成ユニットテスト
4. 会話接地判定ユニットテスト
5. `runConversation` 統合テスト
6. 同型反復抑制の統計テスト
7. 既存ログUI互換の回帰テスト

### テストシナリオ詳細
1. 「遊園地に行った + 楽しかった + また行きたい」が `experience` 候補として採用される。
2. `Fact` はあるが `Appraisal` が無い候補は棄却される。
3. 同一署名イベントがクールダウン中は採用優先度が下がる。
4. `heard` の confidence が direct より低く保持される。
5. Brief が存在する場合、Prompt に anchor が必ず含まれる。
6. Grounding 判定NGなら1回だけ再生成する。
7. ログUIが追加 meta 項目で崩れない。

## ロールアウトと運用
1. Feature Flag で Experience モードを段階有効化。
2. 接地率・同型連投率を計測。
3. しきい値未達時の調整手順を固定。

### Feature Flag（提案）
1. `NEXT_PUBLIC_EXPERIENCE_MODE=on|off`
2. `NEXT_PUBLIC_EXPERIENCE_VARIATION=high|normal|low`
3. `NEXT_PUBLIC_EXPERIENCE_RUMOR=on|off`

### 初期運用しきい値
1. Grounding Rate: 70%以上
2. 同型連投率: 15%未満
3. アラート条件: 24時間平均で目標未達

### 調整順序
1. クールダウン値調整
2. ドメイン配分調整
3. 噂伝播係数調整
4. Briefスコア重み調整

## 非目標
1. スケジューラ発火ロジックの再設計
2. 管理UIでの手動イベント作成
3. 初回での大規模噂ネットワーク実装

## 前提・確定事項
1. プレイヤーごとに世界が異なるため、開発側手動イベント投入は採用しない。
2. 会話表現は明示/暗示バランスを採用する。
3. 出来事参照は必須化しない。
4. `どこへ行った/誰を見た` は `Appraisal` があれば有効な具体イベントとみなす。

## 付録A: 具体イベント例（本仕様準拠）
1. Fact: 「遊園地に行った」  
   Appraisal: 「思ったより楽しかった」  
   Hook: 「今度一緒に行こう」  
2. Fact: 「バイトで変わった客に対応した」  
   Appraisal: 「疲れたけど後から少し面白かった」  
   Hook: 「誰かに話して整理したい」  
3. Fact: 「帰り道で同級生を見かけた」  
   Appraisal: 「声をかけられず引きずっている」  
   Hook: 「今から連絡すべきか相談したい」

## 付録B: 実装対象ファイル（初期案）
1. `apps/web/lib/drizzle/schema.ts`（新テーブル）
2. `apps/web/drizzle/*`（migration）
3. `packages/shared/types/*`（Experience型）
4. `apps/web/lib/conversation/run-conversation.ts`（brief挿入）
5. `packages/shared/gpt/prompts/conversation-prompt.ts`（brief入力化）
6. `apps/web/lib/persist/persist-conversation.ts`（meta拡張）
7. `apps/web/lib/conversation/*.test.ts`（新旧回帰テスト）
