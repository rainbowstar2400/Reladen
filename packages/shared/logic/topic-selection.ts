// packages/shared/logic/topic-selection.ts
// 話題候補の生成とスコアリング

import type {
  TopicCandidate,
  TopicSource,
  SelectedTopic,
  SharedSnippet,
  RecentEvent,
  OffscreenKnowledge,
  ConversationMemory,
  Traits,
} from "@repo/shared/types/conversation-generation";

// ---------------------------------------------------------------------------
// 入力コンテキスト
// ---------------------------------------------------------------------------

/** 会話に参加するキャラクターの情報 */
export type CharacterContext = {
  id: string;
  name: string;
  traits: Partial<Traits>;
  interests: string[];
};

/** ペアの関係性コンテキスト */
export type RelationContext = {
  type: "none" | "acquaintance" | "friend" | "best_friend" | "lover" | "family";
  feelingAtoB: { label: string; score: number };
  feelingBtoA: { label: string; score: number };
};

/** 話題選定に必要なすべての入力 */
export type TopicSelectionInput = {
  characterA: CharacterContext;
  characterB: CharacterContext;
  relation: RelationContext;
  /** 前回の会話記憶（あれば） */
  previousMemory: ConversationMemory | null;
  /** 最近の共有スニペット */
  recentSnippets: SharedSnippet[];
  /** Aが他キャラについて知っていること */
  knowledgeByA: OffscreenKnowledge[];
  /** Bが他キャラについて知っていること */
  knowledgeByB: OffscreenKnowledge[];
  /** 最近の会話で使われた話題（重複回避用） */
  recentTopics: string[];
  /** 天気・場所（small_talk用） */
  environment: { place: string; timeOfDay: string; weather?: string };
  /** キャラクターID → 名前のマップ（third_party 名前解決用） */
  nameMap?: Map<string, string>;
  /** 主導者の最近の出来事（self_experience用） */
  recentEventsA?: RecentEvent[];
  /** 現在の日付（seasonal用、例: "2026-03-18"） */
  currentDate?: string;
};

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

/** 関係性の親密度スコア（高いほど個人的な話題が出やすい） */
const INTIMACY: Record<string, number> = {
  none: 0,
  acquaintance: 1,
  friend: 3,
  best_friend: 4,
  lover: 5,
  family: 4,
};

/** 鮮度減衰: 最近使った話題のスコア減点 */
const FRESHNESS_PENALTY = -3;

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/**
 * 候補ラベルが最近の話題と一致するか（部分一致で判定）
 *
 * recentTopics は LLM 生成の自然言語（例: "料理の話"）、
 * candidate.label は興味タグ等の短い文字列（例: "料理"）のため
 * 完全一致では機能しない。双方向の部分一致で判定する。
 */
function isRecentTopic(label: string, recentTopics: string[]): boolean {
  return recentTopics.some(
    (t) => t.includes(label) || label.includes(t),
  );
}

// ---------------------------------------------------------------------------
// 候補生成
// ---------------------------------------------------------------------------

function generateSharedInterestCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  const shared = input.characterA.interests.filter((tag) =>
    input.characterB.interests.includes(tag),
  );
  return shared.map((tag) => ({
    source: "shared_interest" as TopicSource,
    label: tag,
    detail: `${input.characterA.name}と${input.characterB.name}の共通の興味`,
    score: 0, // scoreCandidateで設定
  }));
}

function generatePersonalInterestCandidates(
  input: TopicSelectionInput,
  initiator: CharacterContext,
): TopicCandidate[] {
  const shared = input.characterA.interests.filter((tag) =>
    input.characterB.interests.includes(tag),
  );
  // 共通興味を除いた主導者の個人的興味
  const personal = initiator.interests.filter((tag) => !shared.includes(tag));
  return personal.map((tag) => ({
    source: "personal_interest" as TopicSource,
    label: tag,
    detail: `${initiator.name}の興味`,
    score: 0,
  }));
}

function generateContinuationCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  if (!input.previousMemory?.unresolvedThreads?.length) return [];
  return input.previousMemory.unresolvedThreads.map((thread) => ({
    source: "continuation" as TopicSource,
    label: thread,
    detail: "前回の会話の続き",
    score: 0,
  }));
}

function generateSnippetCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  return input.recentSnippets.map((snippet) => ({
    source: "snippet" as TopicSource,
    label: snippet.text,
    detail: `${snippet.source}で発生`,
    score: 0,
  }));
}

function generateThirdPartyCandidates(
  input: TopicSelectionInput,
  initiator: CharacterContext,
  responder: CharacterContext,
): TopicCandidate[] {
  // 主導者が知っている第三者の知識
  const initiatorKnowledge = initiator === input.characterA
    ? input.knowledgeByA
    : input.knowledgeByB;

  // 第三者ごとにまとめる
  const bySubject = new Map<string, OffscreenKnowledge[]>();
  for (const k of initiatorKnowledge) {
    // 会話参加者自身に関する知識は除外
    if (k.about === initiator.id || k.about === responder.id) continue;
    const list = bySubject.get(k.about) ?? [];
    list.push(k);
    bySubject.set(k.about, list);
  }

  const candidates: TopicCandidate[] = [];
  bySubject.forEach((facts, aboutId) => {
    const name = input.nameMap?.get(aboutId) ?? aboutId;
    candidates.push({
      source: "third_party" as TopicSource,
      label: `${name}の近況`,
      detail: facts.map((f) => f.fact).join("; "),
      score: 0,
      aboutCharacterId: aboutId,
    });
  });
  return candidates;
}

function generateSelfExperienceCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  const events = input.recentEventsA ?? [];
  return events.map((ev) => ({
    source: "self_experience" as TopicSource,
    label: ev.fact ?? "最近の出来事",
    detail: "自分の最近の体験",
    score: 0,
  }));
}

function generateHeartToHeartCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  // カテゴリのみ選定。具体的な内容はGPTに委ねる
  return [{
    source: "heart_to_heart" as TopicSource,
    label: "内面の話・お互いを知る",
    detail: "自己開示や相手への質問",
    score: 0,
  }];
}

function generateSmallTalkCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  const { place, timeOfDay, weather } = input.environment;
  const candidates: TopicCandidate[] = [
    {
      source: "small_talk" as TopicSource,
      label: `${place}での出来事`,
      detail: `${timeOfDay}の${place}`,
      score: 0,
    },
  ];
  if (weather) {
    candidates.push({
      source: "small_talk" as TopicSource,
      label: `${weather}の話`,
      detail: `今日の天気: ${weather}`,
      score: 0,
    });
  }
  return candidates;
}

/** 現在日付から季節を判定 */
function getSeason(dateStr?: string): string {
  if (!dateStr) return "季節の話題";
  const month = new Date(dateStr).getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

function generateSeasonalCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  const season = getSeason(input.currentDate);
  return [{
    source: "seasonal" as TopicSource,
    label: `${season}の話題`,
    detail: `季節・時事ネタ（${season}）`,
    score: 0,
  }];
}

// ---------------------------------------------------------------------------
// スコアリング
// ---------------------------------------------------------------------------

function scoreCandidate(
  candidate: TopicCandidate,
  input: TopicSelectionInput,
  initiator: CharacterContext,
): TopicCandidate {
  let score = 0;
  const intimacy = INTIMACY[input.relation.type] ?? 0;
  const sociability = initiator.traits.sociability ?? 3;
  const expressiveness = initiator.traits.expressiveness ?? 3;

  switch (candidate.source) {
    case "shared_interest":
      // 共通興味は安定して高スコア
      score = 6 + intimacy * 0.5;
      break;

    case "personal_interest":
      // 社交性が高いと個人的話題を振りやすい
      // 親密度が低いと出しにくい
      score = 3 + sociability * 0.5 + intimacy * 0.3;
      if (intimacy <= 1) score -= 2;
      break;

    case "continuation":
      // 前回の続きは自然なので基礎点高め
      score = 7 + intimacy * 0.3;
      break;

    case "snippet":
      // 共有した出来事は話題にしやすい
      score = 5 + intimacy * 0.4;
      break;

    case "third_party":
      // 第三者の話題は親しくないと不自然
      score = 2 + intimacy * 0.8 + sociability * 0.3;
      if (intimacy <= 1) score -= 3;
      break;

    case "self_experience":
      // 自分の最近の出来事。中程度の基礎スコア
      score = 4 + intimacy * 0.4;
      break;

    case "heart_to_heart":
      // 自己開示・質問。高親密度で強い
      score = 2 + intimacy * 0.8;
      if (intimacy <= 1) score -= 3;
      break;

    case "small_talk":
      // 世間話。低親密度でもOK
      score = 3;
      break;

    case "seasonal":
      // 季節・時事。低親密度でもOK
      score = 2;
      break;
  }

  // 鮮度: 最近同じ話題を使っていたら減点（部分一致で判定）
  if (isRecentTopic(candidate.label, input.recentTopics)) {
    score += FRESHNESS_PENALTY;
  }

  // 最低スコアは0
  return { ...candidate, score: Math.max(0, score) };
}

// ---------------------------------------------------------------------------
// メインロジック
// ---------------------------------------------------------------------------

/**
 * すべての話題候補を生成し、スコアリングして最適な話題を選定する
 */
export function selectTopic(
  input: TopicSelectionInput,
  initiator: CharacterContext,
  responder: CharacterContext,
): { selected: SelectedTopic; candidates: TopicCandidate[] } {
  // 全候補を生成（9種ソース）
  const rawCandidates: TopicCandidate[] = [
    ...generateSharedInterestCandidates(input),
    ...generatePersonalInterestCandidates(input, initiator),
    ...generateContinuationCandidates(input),
    ...generateSnippetCandidates(input),
    ...generateThirdPartyCandidates(input, initiator, responder),
    ...generateSelfExperienceCandidates(input),
    ...generateHeartToHeartCandidates(input),
    ...generateSmallTalkCandidates(input),
    ...generateSeasonalCandidates(input),
  ];

  // スコアリング
  const scored = rawCandidates.map((c) => scoreCandidate(c, input, initiator));

  // スコア降順ソート（デバッグ・ログ用）
  scored.sort((a, b) => b.score - a.score);

  // 重み付きランダム選択（スコア>0の候補のみ）
  const eligible = scored.filter((c) => c.score > 0);

  let best: TopicCandidate | undefined;
  if (eligible.length > 0) {
    const totalWeight = eligible.reduce((sum, c) => sum + c.score, 0);
    let r = Math.random() * totalWeight;
    for (const c of eligible) {
      r -= c.score;
      if (r <= 0) { best = c; break; }
    }
    // 浮動小数点誤差対策
    if (!best) best = eligible[eligible.length - 1];
  }

  if (!best) {
    // フォールバック: small_talk
    const fallback: SelectedTopic = {
      source: "small_talk",
      label: `${input.environment.place}での出来事`,
      detail: `${input.environment.timeOfDay}の${input.environment.place}`,
    };
    return { selected: fallback, candidates: scored };
  }

  // third_party の場合は追加コンテキストを付与
  const selected: SelectedTopic = {
    source: best.source,
    label: best.label,
    detail: best.detail,
  };

  if (best.source === "third_party" && best.aboutCharacterId) {
    const aboutId = best.aboutCharacterId;
    const characterName = input.nameMap?.get(aboutId) ?? aboutId;

    // 対象キャラの知識をまとめる
    const initiatorKnowledge = initiator === input.characterA
      ? input.knowledgeByA
      : input.knowledgeByB;
    const facts = initiatorKnowledge
      .filter((k) => k.about === aboutId)
      .map((k) => k.fact);

    // Bが対象キャラを知っているかチェック
    const responderKnowledge = responder === input.characterA
      ? input.knowledgeByA
      : input.knowledgeByB;
    const listenerKnows = responderKnowledge.some((k) => k.about === aboutId);

    selected.thirdPartyContext = {
      characterName,
      knownFacts: facts,
      listenerKnowsCharacter: listenerKnows,
    };
  }

  return { selected, candidates: scored };
}
