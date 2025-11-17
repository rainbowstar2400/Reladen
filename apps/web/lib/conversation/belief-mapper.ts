// apps/web/lib/conversation/belief-mapper.ts
// Supabase(Postgres)のsnake_caseカラムと、アプリ内部で使うBeliefRecord(camelCase)を相互変換するユーティリティ

import type { BeliefRecord } from "@repo/shared/types/conversation";

type BeliefRow = {
  id?: string;
  resident_id?: string;
  residentId?: string;
  world_facts?: unknown;
  worldFacts?: unknown;
  person_knowledge?: unknown;
  personKnowledge?: unknown;
  updated_at?: string;
  updatedAt?: string;
  deleted?: boolean;
};

function ensureArray<T>(value: unknown, fallback: T): T {
  return Array.isArray(value) ? (value as T) : fallback;
}

function ensureRecord<T extends object>(value: unknown, fallback: T): T {
  return value && typeof value === "object" ? (value as T) : fallback;
}

export function beliefRowToRecord(row: BeliefRow | null | undefined): BeliefRecord | null {
  if (!row?.id) return null;
  const residentId = row.residentId ?? row.resident_id;
  if (!residentId) return null;

  const worldFacts = ensureArray(row.worldFacts ?? row.world_facts, [] as BeliefRecord["worldFacts"]);
  const personKnowledge = ensureRecord(
    row.personKnowledge ?? row.person_knowledge,
    {} as BeliefRecord["personKnowledge"],
  );
  const updatedAt = row.updated_at ?? row.updatedAt ?? new Date().toISOString();

  return {
    id: row.id,
    residentId,
    worldFacts,
    personKnowledge,
    updated_at: updatedAt,
    deleted: row.deleted ?? false,
  };
}

export function recordToBeliefRow(rec: BeliefRecord) {
  return {
    id: rec.id,
    resident_id: rec.residentId,
    world_facts: rec.worldFacts ?? [],
    person_knowledge: rec.personKnowledge ?? {},
    updated_at: rec.updated_at,
    deleted: rec.deleted ?? false,
  };
}
