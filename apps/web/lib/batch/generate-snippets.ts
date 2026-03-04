// apps/web/lib/batch/generate-snippets.ts
// SharedSnippets のインラインバッチ生成（staleness チェック付き）
//
// 会話生成時に呼ばれ、6時間以内にスニペットが生成済みであればスキップする。

import { listKV as listAny, putKV as putAny } from "@/lib/db/kv-server";
import { generateSnippet, type SnippetGenerationInput } from "@repo/shared/logic/snippet-generator";
import { newId } from "@/lib/newId";

const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6時間

type RelationRow = {
  a_id?: string;
  b_id?: string;
  aId?: string;
  bId?: string;
  type?: string;
  deleted?: boolean;
};

type SnippetRow = {
  id?: string;
  participant_a?: string;
  participant_b?: string;
  occurred_at?: string;
  updated_at?: string;
  deleted?: boolean;
};

function pickPair(row: RelationRow): { aId?: string; bId?: string } {
  return {
    aId: typeof row.a_id === "string" ? row.a_id : typeof row.aId === "string" ? row.aId : undefined,
    bId: typeof row.b_id === "string" ? row.b_id : typeof row.bId === "string" ? row.bId : undefined,
  };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * 全ペアを走査し、6時間以内にスニペットがなければ確率的に生成して保存する。
 */
export async function generateSnippetsIfStale(): Promise<number> {
  // 1) 関係性一覧を取得
  const relations = (await listAny("relations")) as unknown as RelationRow[] | null;
  if (!Array.isArray(relations)) return 0;

  // 2) 既存スニペット一覧を取得
  const existingSnippets = (await listAny("shared_snippets")) as unknown as SnippetRow[] | null;
  const now = Date.now();

  // ペアごとに最新の occurred_at を記録
  const recentPairMap = new Map<string, number>();
  if (Array.isArray(existingSnippets)) {
    for (const s of existingSnippets) {
      if (!s || s.deleted) continue;
      const a = s.participant_a;
      const b = s.participant_b;
      if (!a || !b) continue;
      const key = pairKey(a, b);
      const ts = Date.parse(s.occurred_at ?? s.updated_at ?? "");
      if (Number.isFinite(ts)) {
        const existing = recentPairMap.get(key) ?? 0;
        if (ts > existing) recentPairMap.set(key, ts);
      }
    }
  }

  // 3) 各ペアについて staleness チェック → 生成
  let generatedCount = 0;

  for (const rel of relations) {
    if (!rel || rel.deleted || !rel.type || rel.type === "none") continue;
    const { aId, bId } = pickPair(rel);
    if (!aId || !bId) continue;

    const key = pairKey(aId, bId);
    const lastGenerated = recentPairMap.get(key) ?? 0;
    if (now - lastGenerated < STALE_THRESHOLD_MS) continue;

    const input: SnippetGenerationInput = {
      participantA: aId,
      participantB: bId,
      relationType: rel.type,
    };
    const snippet = generateSnippet(input);
    if (!snippet) continue;

    const id = newId();
    const occurredAt = new Date().toISOString();
    await putAny("shared_snippets", {
      id,
      participant_a: snippet.participants[0],
      participant_b: snippet.participants[1],
      text: snippet.text,
      source: snippet.source,
      occurred_at: occurredAt,
      updated_at: occurredAt,
      deleted: false,
    });

    generatedCount++;
  }

  return generatedCount;
}
