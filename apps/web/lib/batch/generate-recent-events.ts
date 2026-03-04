// apps/web/lib/batch/generate-recent-events.ts
// RecentEvents のバッチ生成 + 知識伝播（staleness チェック付き）
//
// 会話生成時にインラインで呼ばれ、12時間以内に生成済みであればスキップする。

import OpenAI from "openai";
import { listKV as listAny, putKV as putAny } from "@/lib/db/kv-server";
import {
  systemPromptRecentEvents,
  buildRecentEventsUserPrompt,
  recentEventsResponseSchema,
  type RecentEventsCharacterInput,
} from "@repo/shared/gpt/prompts/recent-events-prompt";
import {
  propagateKnowledgeBatch,
  type PropagationCharacter,
  type PropagationRelation,
} from "@repo/shared/logic/knowledge-propagation";
import type { RecentEvent } from "@repo/shared/types/conversation-generation";
import { newId } from "@/lib/newId";
import { env } from "@/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const STALE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12時間

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

type ResidentRow = Record<string, any>;
type RelationRow = { a_id?: string; b_id?: string; aId?: string; bId?: string; type?: string; deleted?: boolean };
type RecentEventRow = { id?: string; character_id?: string; generated_at?: string; updated_at?: string; deleted?: boolean; shared_with?: unknown; fact?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTextFromResponse(res: unknown): string | null {
  if (!res) return null;
  const r = res as Record<string, unknown>;
  if (Array.isArray(r.output_text) && r.output_text.length > 0) {
    return (r.output_text as string[]).join("\n").trim();
  }
  if (!Array.isArray(r.output)) return null;
  for (const item of r.output as unknown[]) {
    if (!isRecord(item) || item.type !== "message") continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    const textChunks = (content as Array<Record<string, unknown>>)
      .filter((c) => c.type === "output_text" && typeof c.text === "string")
      .map((c) => (c.text as string).trim());
    if (textChunks.length > 0) return textChunks.join("\n");
  }
  return null;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

/**
 * 12時間以内に生成済みでなければ、全住民の「最近の出来事」を LLM で生成し、
 * 知識伝播を行って保存する。
 */
export async function generateRecentEventsIfStale(): Promise<number> {
  // 1) staleness チェック
  const existingEvents = (await listAny("recent_events")) as unknown as RecentEventRow[] | null;
  const now = Date.now();

  if (Array.isArray(existingEvents)) {
    const latestTs = existingEvents
      .filter((e) => e && !e.deleted)
      .map((e) => Date.parse(e.generated_at ?? e.updated_at ?? ""))
      .filter(Number.isFinite)
      .reduce((max, ts) => Math.max(max, ts), 0);
    if (now - latestTs < STALE_THRESHOLD_MS) {
      return 0; // まだ新しい → スキップ
    }
  }

  // 2) 全住民を読み込み
  const residents = (await listAny("residents")) as unknown as ResidentRow[] | null;
  if (!Array.isArray(residents) || residents.length === 0) return 0;

  const presets = (await listAny("presets")) as unknown as Array<Record<string, any>> | null;
  const presetMap = new Map<string, Record<string, any>>();
  if (Array.isArray(presets)) {
    for (const p of presets) {
      if (p?.id && !p.deleted) presetMap.set(p.id, p);
    }
  }

  const charInputs: RecentEventsCharacterInput[] = [];
  const propChars: PropagationCharacter[] = [];

  for (const r of residents) {
    if (!r || r.deleted || !r.id) continue;

    const occupationId = typeof r.occupation === "string" ? r.occupation : null;
    const occupationPreset = occupationId ? presetMap.get(occupationId) : undefined;
    const occupation = (occupationPreset as any)?.label ?? null;

    const interests: string[] = Array.isArray(r.interests) ? r.interests.filter((i: unknown) => typeof i === "string") : [];
    const traits: Record<string, number> = {};
    if (r.traits && typeof r.traits === "object") {
      for (const key of ["sociability", "empathy", "stubbornness", "activity", "expressiveness"]) {
        const v = (r.traits as any)[key];
        if (typeof v === "number" && v >= 1 && v <= 5) traits[key] = v;
      }
    }

    charInputs.push({
      id: r.id,
      name: r.name ?? "不明",
      occupation,
      interests,
    });

    propChars.push({
      id: r.id,
      name: r.name ?? "不明",
      traits,
    });
  }

  if (charInputs.length === 0) return 0;

  // 3) LLM で出来事生成
  const userPrompt = buildRecentEventsUserPrompt(charInputs);
  const res = await client.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    input: [
      { role: "system", content: [{ type: "input_text", text: systemPromptRecentEvents }] },
      { role: "user", content: [{ type: "input_text", text: userPrompt }] },
    ],
    text: {
      format: {
        name: recentEventsResponseSchema.name,
        type: "json_schema",
        schema: recentEventsResponseSchema.schema,
        strict: recentEventsResponseSchema.strict,
      },
    },
  } as any);

  const content = extractTextFromResponse(res);
  if (!content) {
    console.warn("[generateRecentEventsIfStale] GPT returned empty response.");
    return 0;
  }

  let parsed: { events: Array<{ characterId: string; fact: string }> };
  try {
    parsed = JSON.parse(content);
  } catch {
    console.warn("[generateRecentEventsIfStale] JSON parse failed.");
    return 0;
  }

  if (!Array.isArray(parsed.events) || parsed.events.length === 0) return 0;

  // 4) DB に保存
  const charIdSet = new Set(charInputs.map((c) => c.id));
  const savedEvents: RecentEvent[] = [];
  const generatedAt = new Date().toISOString();

  for (const ev of parsed.events) {
    if (!ev.characterId || !ev.fact || !charIdSet.has(ev.characterId)) continue;
    const id = newId();
    await putAny("recent_events", {
      id,
      character_id: ev.characterId,
      fact: ev.fact,
      generated_at: generatedAt,
      shared_with: [],
      updated_at: generatedAt,
      deleted: false,
    });
    savedEvents.push({
      id,
      characterId: ev.characterId,
      fact: ev.fact,
      generatedAt,
      sharedWith: [],
    });
  }

  // 5) 知識伝播
  const relations = (await listAny("relations")) as unknown as RelationRow[] | null;
  const propRelations: PropagationRelation[] = [];
  if (Array.isArray(relations)) {
    for (const rel of relations) {
      if (!rel || rel.deleted || !rel.type || rel.type === "none") continue;
      const aId = typeof rel.a_id === "string" ? rel.a_id : typeof rel.aId === "string" ? rel.aId : undefined;
      const bId = typeof rel.b_id === "string" ? rel.b_id : typeof rel.bId === "string" ? rel.bId : undefined;
      if (!aId || !bId) continue;
      propRelations.push({
        fromId: aId,
        toId: bId,
        type: rel.type as PropagationRelation["type"],
      });
    }
  }

  const propResult = propagateKnowledgeBatch({
    characters: propChars,
    relations: propRelations,
    events: savedEvents,
  });

  // 6) 伝播された知識を保存
  const knowledgeAt = new Date().toISOString();
  for (const k of propResult.newKnowledge) {
    await putAny("offscreen_knowledge", {
      id: newId(),
      learned_by: k.learnedBy,
      about: k.about,
      fact: k.fact,
      source: k.source,
      learned_at: knowledgeAt,
      updated_at: knowledgeAt,
      deleted: false,
    });
  }

  // 7) 伝播済みイベントの shared_with を更新
  const propagatedByEvent = new Map<string, string[]>();
  for (const p of propResult.propagated) {
    const existing = propagatedByEvent.get(p.eventId) ?? [];
    existing.push(p.receiverId);
    propagatedByEvent.set(p.eventId, existing);
  }

  for (const ev of savedEvents) {
    const receivers = propagatedByEvent.get(ev.id);
    if (!receivers || receivers.length === 0) continue;
    const updatedSharedWith = [...ev.sharedWith, ...receivers];
    await putAny("recent_events", {
      id: ev.id,
      shared_with: updatedSharedWith,
      updated_at: new Date().toISOString(),
    });
  }

  return savedEvents.length;
}
