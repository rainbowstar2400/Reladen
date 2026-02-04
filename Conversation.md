# 会話生成 改善案（Conversation）

最終更新: 2026-02-01

## 目的
- 住人同士の会話を「自然に」「キャラクターらしく」感じられる品質に引き上げる
- 出力の一貫性（口調・関係性・継続性）を高めつつ、評価/永続化と整合する
- 実装コストに応じて段階的に導入できる計画にする

## 現行フロー（コード参照）

### 全体シーケンス
1) `apps/web/lib/scheduler/conversation-scheduler.ts`
   - 起床中の住人を抽出（`selectConversationCandidates`）
   - 既存スレッド or 新規ペアを選定
   - `/api/conversations/start` を呼び出し
2) `apps/web/app/api/conversations/start/route.ts`
   - 入力検証（participants / context 等）
   - `runConversation` を実行
3) `apps/web/lib/conversation/run-conversation.ts`
   - thread / beliefs / residents を読み込み
   - `callGptForConversation` で生成
   - `evaluateConversation` → `persistConversation`
4) 永続化（events / topic_threads / beliefs / feelings / notifications）

### 生成入力の実体
- thread: `id / participants / status / topic / updated_at / lastEventId`
- beliefs: `BeliefRecord`（personKnowledge など）
- residents: `ConversationResidentProfile`
  - id, name, mbti, gender, age, occupation
  - speechPreset, speechPresetDescription, speechExample
  - firstPerson, traits, interests, summary
- topicHint / lastSummary
- time context: `formatTimeOfDayJst` による JST の時間帯

### プロンプトの特徴（`conversation-prompt.ts`）
- system prompt で「JSONのみ出力」を強制
- **一人称の厳密な一致**を強く要求（自然さより優先）
- speech preset 名/説明/例文で口調を誘導
- lastSummary / topic / time などを追加

### モデル呼び出し（`call-gpt-for-conversation.ts`）
- model: `gpt-5.2` / temperature: 0.8
- strict JSON schema の response format
- sanitize: speaker が参加者に合わない場合は順番で補正

### 出力スキーマ（`packages/shared/gpt/schemas/conversation-output.ts`）
- lines: `{ speaker: uuid, text: string }[]`
- meta:
  - tags: string[]
  - newKnowledge: { target, key }[]
  - signals: ['continue' | 'close' | 'park']
  - qualityHints: { turnBalance, tone }
  - debug: string[]

### 評価・永続化
- `evaluateConversation` で tags/qualityHints/signals を評価
- `persistConversation` で events に保存＋topic_threads 更新
- newKnowledge から Belief を更新
- feelings/relations を更新して UI 反映

---

## 課題の詳細（自然さ・キャラらしさの阻害要因）

### 1) 一人称強制が自然さを阻害
- system prompt が一人称厳守を強く要求し、
  不自然な言い回しや過度な一人称使用が起こりやすい

### 2) 知識・性格データが活かされない
- Belief / traits / interests が JSON のまま渡される
- 会話で使える形に「要約」されていないため参照されづらい

### 3) 関係性/感情/呼称が無視される
- relations / feelings / nicknames が会話生成に渡されない
- 結果として敬語/距離感/呼称が固定化しやすい

### 4) 継続性が弱い
- lastSummary が空になりがち
- 直近の話題が引き継がれず、会話が断片化

### 5) タグ・qualityHints が不安定
- 出力の許可リストがプロンプトに明示されていない
- 評価の重み（conversation-weights.json）と出力が揃わない

### 6) 会話構造が単調
- 「役割」や「意図」が明示されず、話の流れが平坦

---

## 改善案（詳細・優先度順）

### 1) コンテキスト強化（最優先）

#### 1-1. 関係性/感情/呼称の反映
- **何をするか**
  - Relation/Feeling/Nickname をテキスト化してプロンプトに追加
- **どう使うか**
  - Relation → 敬語/距離感/親しさを決定
  - Feeling → 気まずさ/好意/興味のトーンへ変換
  - Nickname → 呼称がある場合、会話内の呼び名に固定
- **実装イメージ**
  - runConversation で `relations/feelings/nicknames` を読み込み
  - 参加者ペアに対応する情報のみ抽出
  - buildUserPromptConversation に “関係性セクション” を追加
- **例（プロンプト文）**
  - 「A と B の関係: 友達。互いにタメ口が基本」
  - 「A→Bの感情: 好きかも（score: 63）/ B→A: 気になる（score: 52）」
  - 「A は B を『〇〇』と呼ぶ / B は A を『△△』と呼ぶ」

#### 1-2. Belief の要約化
- **何をするか**
  - `personKnowledge` を “知っている事実の箇条書き” に変換
- **どう使うか**
  - 「AがBについて知っていること: …」という形式に整形
  - 直近学習のみを優先（古いものは省略/サマリ化）
- **例**
  - 「AがBについて知っていること: 仕事は営業 / 甘いものが好き / 週末はランニング」

#### 1-3. traits / interests の自然言語化
- **何をするか**
  - 数値やJSONを「傾向」へ変換
- **例**
  - 社交性 5 → “かなり社交的”
  - 表現力 2 → “口数は少なめ”

---

### 2) プロンプト設計の改善（高優先）

#### 2-1. タグ/qualityHints の許可リスト提示
- **目的**: 生成の揺れを減らし、評価と一致させる
- **実装**
  - `public/config/conversation-weights.json` のタグ一覧を提示
  - `qualityHints` キーも列挙し、使用可能なキーだけ書かせる
- **例文**
  - 「tags は次の中から選ぶ: 共感, 感謝, 称賛, 協力, 否定, 皮肉, 非難, 情報共有, 軽い冗談」
  - 「qualityHints は次のキーのみ: coherence.good, coherence.poor, tone.gentle, tone.harsh」

#### 2-2. 役割（会話内ロール）の明示
- **目的**: 話の流れを自然にする
- **例**
  - 「A: 話題を切り出す / B: 反応して掘り下げる」
  - 「A: 感情表現多め / B: 事実や具体例を添える」

#### 2-3. 一人称厳守の運用変更
- **現状問題**: 強圧で自然な文章が減る
- **改善案**
  - プロンプトは “一人称を使う時は厳守” に緩和
  - 生成後に誤表記を検知し、再生成または補正
- **検知案**
  - 禁止表記（オレ/おれ/俺 など）を辞書でチェック

---

### 3) 生成後処理（中優先）

#### 3-1. 再生成トリガー
- **条件例**
  - 話者バランスが大きく偏る
  - 同語尾/同語彙の連続出現
  - speechPreset 由来の特徴語が極端に少ない
- **方針**
  - 再生成は最大1〜2回（コスト抑制）
  - リトライ時に改善指示を追加

#### 3-2. 口調チェック
- **内容**
  - speechPreset ごとに「語尾/口癖/敬語率」の簡易辞書を用意
  - 含有率が一定以下なら再生成

---

### 4) データ拡張（中〜低優先）

#### 4-1. speechPreset の構造化
- **追加フィールド例**
  - styleHints: { ending: [], tempo: 'short'|'normal'|'long', politeness: 0-100 }
  - avoid: string[]（禁止語）
  - topicRepertoire: string[]（話題傾向）

#### 4-2. Belief の鮮度管理
- learnedAt が古いキーは短く要約
- 「最近知ったこと」と「昔から知っていること」を分ける

---

### 5) 評価ループ（中〜低優先）
- 良質な会話を蓄積し、短い例文として動的にプロンプトへ
- 評価スコア（バランス・タグ）を次回生成のヒントに

---

## 実装案（より具体的）

### Quick Wins（1〜2日）
1) `buildUserPromptConversation` を拡張
   - 関係性/感情/呼称のセクションを追加
   - Belief の短文サマリを追加
   - tags / qualityHints の許可リストを明示
2) `runConversation` で relations/feelings/nicknames を読み込み
   - participant ペアに対応するものだけ抽出
3) `lastSummary` を直近会話イベントから生成
   - 最新1件の lines を1〜2文に圧縮

### Medium（3〜7日）
1) speechPreset の構造化＋辞書化
2) 再生成ルール実装（バランス/口調/重複）
3) 意図タグ導入（内部ロジックで作成しプロンプトに反映）

### Long（1〜2週）
1) 会話ログからキャラ辞書を自動生成
2) 住人ごとの話題傾向（RAG 風検索）

---

## 成功指標（KPI）
- 口調一致率（語尾/口癖含有率）
- 直近会話参照率（lastSummary / Belief の利用率）
- 話者バランス（ターン差の平均値）
- 同語彙の反復率（低いほど自然）

---

## 注意点
- 一人称厳守は重要だが、自然さを犠牲にしすぎない
- tags/qualityHints は評価ロジックと必ず整合
- lastSummary は短く（長文は逆効果）

---

## 参考ファイル
- プロンプト: `packages/shared/gpt/prompts/conversation-prompt.ts`
- 呼び出し: `apps/web/lib/gpt/call-gpt-for-conversation.ts`
- オーケストレータ: `apps/web/lib/conversation/run-conversation.ts`
- 評価: `apps/web/lib/evaluation/evaluate-conversation.ts`
- 重み: `public/config/conversation-weights.json`
- 永続化: `apps/web/lib/persist/persist-conversation.ts`
