import type { Relation } from '@/types';

export type NormalizedRelationPair = {
  aId: string;
  bId: string;
  key: string;
};

function parseUpdatedAtMs(value: unknown): number {
  if (typeof value !== 'string' || value.trim().length === 0) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

function relationIdForSort(relation: Relation): string {
  return typeof relation.id === 'string' ? relation.id : '';
}

export function normalizeRelationPair(aId: string, bId: string): NormalizedRelationPair {
  if (!aId || !bId) {
    throw new Error('[normalizeRelationPair] aId and bId are required.');
  }
  const [left, right] = [aId, bId].sort((a, b) => a.localeCompare(b));
  return {
    aId: left,
    bId: right,
    key: `${left}:${right}`,
  };
}

export function relationPairKey(aId: string, bId: string): string {
  return normalizeRelationPair(aId, bId).key;
}

export function buildRelationDedupPlan(relations: Relation[], nowIso: string) {
  const byKey = new Map<string, Relation[]>();

  for (const relation of relations) {
    if (typeof relation.a_id !== 'string' || typeof relation.b_id !== 'string') continue;
    const key = relationPairKey(relation.a_id, relation.b_id);
    const list = byKey.get(key) ?? [];
    list.push(relation);
    byKey.set(key, list);
  }

  const canonicalByKey = new Map<string, Relation>();
  const tombstones: Relation[] = [];

  for (const [key, group] of byKey.entries()) {
    const sorted = [...group].sort((a, b) => {
      const updatedDiff = parseUpdatedAtMs(b.updated_at) - parseUpdatedAtMs(a.updated_at);
      if (updatedDiff !== 0) return updatedDiff;
      return relationIdForSort(a).localeCompare(relationIdForSort(b));
    });

    const canonical = sorted[0];
    canonicalByKey.set(key, canonical);

    for (const duplicate of sorted.slice(1)) {
      const normalizedPair = normalizeRelationPair(duplicate.a_id, duplicate.b_id);
      const alreadyNormalizedTombstone =
        duplicate.deleted === true
        && duplicate.a_id === normalizedPair.aId
        && duplicate.b_id === normalizedPair.bId;
      if (alreadyNormalizedTombstone) continue;
      tombstones.push({
        ...duplicate,
        a_id: normalizedPair.aId,
        b_id: normalizedPair.bId,
        updated_at: nowIso,
        deleted: true,
      });
    }
  }

  return { canonicalByKey, tombstones };
}
