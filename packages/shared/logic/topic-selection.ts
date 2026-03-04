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
  /** 天気・場所（environmental用） */
  environment: { place: string; timeOfDay: string; weather?: string };
  /** キャラクターID → 名前のマップ（third_party 名前解決用） */
  nameMap?: Map<string, string>;
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

function generateFeelingShiftCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  const candidates: TopicCandidate[] = [];
  // 好感度が高めの場合は距離感の変化が話題になりうる
  const avgScore = (input.relation.feelingAtoB.score + input.relation.feelingBtoA.score) / 2;
  if (avgScore >= 60 || avgScore <= 20) {
    candidates.push({
      source: "feeling_shift" as TopicSource,
      label: "最近の距離感の変化",
      detail: avgScore >= 60 ? "親しみが増している" : "ぎこちなさがある",
      score: 0,
    });
  }
  return candidates;
}

function generateEnvironmentalCandidates(
  input: TopicSelectionInput,
): TopicCandidate[] {
  const { place, timeOfDay, weather } = input.environment;
  const candidates: TopicCandidate[] = [
    {
      source: "environmental" as TopicSource,
      label: `${place}での出来事`,
      detail: `${timeOfDay}の${place}`,
      score: 0,
    },
  ];
  if (weather) {
    candidates.push({
      source: "environmental" as TopicSource,
      label: `${weather}の話`,
      detail: `今日の天気: ${weather}`,
      score: 0,
    });
  }
  return candidates;
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

    case "feeling_shift":
      // 関係性の変化は親密度高い場合のみ
      score = 1 + intimacy * 0.6 + expressiveness * 0.3;
      if (intimacy <= 2) score -= 2;
      break;

    case "environmental":
      // フォールバック用。基礎点低め
      score = 2;
      break;
  }

  // 鮮度: 最近同じ話題を使っていたら減点
  if (input.recentTopics.includes(candidate.label)) {
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
  // 全候補を生成
  const rawCandidates: TopicCandidate[] = [
    ...generateSharedInterestCandidates(input),
    ...generatePersonalInterestCandidates(input, initiator),
    ...generateContinuationCandidates(input),
    ...generateSnippetCandidates(input),
    ...generateThirdPartyCandidates(input, initiator, responder),
    ...generateFeelingShiftCandidates(input),
    ...generateEnvironmentalCandidates(input),
  ];

  // スコアリング
  const scored = rawCandidates.map((c) => scoreCandidate(c, input, initiator));

  // スコア降順ソート
  scored.sort((a, b) => b.score - a.score);

  // 最高スコアの候補を採用。全候補が低スコアならenvironmentalにフォールバック
  const best = scored[0];

  if (!best || best.score <= 0) {
    // フォールバック: environmental
    const fallback: SelectedTopic = {
      source: "environmental",
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
