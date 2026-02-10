// apps/web/lib/client/consult-storage.ts
'use client';

// 相談回答を IndexedDB(Tauri対応含む) に保存する実装。
// 初回アクセス時は localStorage から自動移行します。

import { getLocal, putLocal } from '@/lib/db-local';

const LS_KEY = (id: string) => `consult:${id}`;
const STORE = 'consult_answers' as const;

export type StoredConsultAnswer = {
  id: string;
  selectedChoiceId: string | null;
  decidedAt: string; // ISO
};

type AnswerEntity = StoredConsultAnswer & {
  updated_at: string; // ISO
  deleted: boolean;
};

type ConsultEventEntity = {
  id: string;
  kind: string;
  payload: Record<string, any>;
  updated_at: string;
  deleted: boolean;
};

export type SaveConsultAnswerResult = {
  applied: boolean;
  alreadyAnswered: boolean;
  delta: number;
  residentId: string | null;
  before: number | null;
  after: number | null;
  selectedChoiceId: string | null;
};

function clampTrust(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseTrust(value: unknown) {
  const num = typeof value === 'number' ? value : Number(value);
  return clampTrust(Number.isFinite(num) ? num : 50);
}

function resolveTrustDeltaByChoice(payload: Record<string, any> | null | undefined): Record<string, number> {
  const source = payload?.trustDeltaByChoice ?? payload?.trust_delta_by_choice;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const map: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    const num = Number(value);
    if (Number.isFinite(num)) map[String(key)] = Math.round(num);
  }
  return map;
}

function resolveConsultResidentId(payload: Record<string, any> | null | undefined): string | null {
  const direct = payload?.residentId ?? payload?.resident_id;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  const participants = payload?.participants;
  if (Array.isArray(participants)) {
    const first = participants.find((id) => typeof id === 'string' && id.length > 0);
    if (typeof first === 'string') return first;
  }
  return null;
}

async function loadConsultEvent(id: string): Promise<ConsultEventEntity | null> {
  const local = (await getLocal('events' as any, id)) as any;
  if (local && local.kind === 'consult') {
    return {
      id: local.id,
      kind: local.kind,
      payload: (local.payload ?? {}) as Record<string, any>,
      updated_at: local.updated_at ?? new Date().toISOString(),
      deleted: Boolean(local.deleted),
    };
  }

  try {
    const res = await fetch(`/api/consults/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const src = json?.consult ?? json ?? {};
    const payload = (src?.payload ?? src?.data ?? src ?? {}) as Record<string, any>;
    return {
      id: src?.id ?? id,
      kind: src?.kind ?? 'consult',
      payload,
      updated_at: src?.updated_at ?? new Date().toISOString(),
      deleted: false,
    };
  } catch {
    return null;
  }
}

async function migrateFromLocalStorageIfNeeded(id: string) {
  try {
    // 既にDBにあれば移行不要
    const exists = (await getLocal(STORE as any, id)) as AnswerEntity | undefined;
    if (exists) return;
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(LS_KEY(id));
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredConsultAnswer | null;
    if (!parsed) return;
    const now = new Date().toISOString();
    const entity: AnswerEntity = {
      id,
      selectedChoiceId: parsed.selectedChoiceId ?? null,
      decidedAt: parsed.decidedAt ?? now,
      updated_at: now,
      deleted: false,
    };
    await putLocal(STORE as any, entity as any);
    localStorage.removeItem(LS_KEY(id));
  } catch {
    // noop
  }
}

export async function loadConsultAnswer(id: string): Promise<StoredConsultAnswer | null> {
  await migrateFromLocalStorageIfNeeded(id);
  try {
    const row = (await getLocal(STORE as any, id)) as AnswerEntity | undefined;
    if (!row) return null;
    return { id: row.id, selectedChoiceId: row.selectedChoiceId ?? null, decidedAt: row.decidedAt };
  } catch {
    return null;
  }
}

export async function saveConsultAnswer(
  id: string,
  selectedChoiceId: string | null
): Promise<SaveConsultAnswerResult> {
  await migrateFromLocalStorageIfNeeded(id);

  const existingAnswer = (await getLocal(STORE as any, id)) as AnswerEntity | undefined;
  if (existingAnswer && !existingAnswer.deleted && existingAnswer.selectedChoiceId != null) {
    return {
      applied: false,
      alreadyAnswered: true,
      delta: 0,
      residentId: null,
      before: null,
      after: null,
      selectedChoiceId: existingAnswer.selectedChoiceId ?? null,
    };
  }

  const now = new Date().toISOString();
  const entity: AnswerEntity = {
    id,
    selectedChoiceId: selectedChoiceId ?? null,
    decidedAt: now,
    updated_at: now,
    deleted: false,
  };

  try {
    await putLocal(STORE as any, entity as any);
  } catch {
    // フォールバック（非常時のみ）
    try {
      const { enqueueOutbox } = await import('@/lib/sync/outbox');
      await enqueueOutbox({
        id,
        table: 'consult_answers',
        data: {
          id,
          selectedChoiceId: entity.selectedChoiceId,
          decidedAt: entity.decidedAt,
          updated_at: entity.updated_at,
          deleted: entity.deleted,
        },
        updated_at: entity.updated_at,
        deleted: entity.deleted,
      });
    } catch {
      // noop
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('reladen:request-sync'));
      }
    } catch {
      // noop
    }

    return {
      applied: false,
      alreadyAnswered: false,
      delta: 0,
      residentId: null,
      before: null,
      after: null,
      selectedChoiceId: entity.selectedChoiceId,
    };
  }

  const consultEvent = await loadConsultEvent(id);
  const payload = (consultEvent?.payload ?? {}) as Record<string, any>;
  const trustDeltaByChoice = resolveTrustDeltaByChoice(payload);
  const delta =
    entity.selectedChoiceId && trustDeltaByChoice[entity.selectedChoiceId] != null
      ? trustDeltaByChoice[entity.selectedChoiceId]
      : 0;
  const residentId = resolveConsultResidentId(payload);

  let before: number | null = null;
  let after: number | null = null;
  let applied = false;

  if (residentId && delta !== 0) {
    const resident = (await getLocal('residents' as any, residentId)) as Record<string, any> | undefined;
    if (resident) {
      before = parseTrust(resident.trustToPlayer ?? resident.trust_to_player);
      after = clampTrust(before + delta);
      await putLocal('residents' as any, {
        ...resident,
        trustToPlayer: after,
        updated_at: now,
        deleted: Boolean(resident.deleted),
      });
      applied = true;
    }
  }

  if (consultEvent) {
    const existingSystemAfter = Array.isArray(payload.systemAfter)
      ? payload.systemAfter.map(String)
      : [];
    const trustLine = delta > 0 ? '信頼度：↑' : delta < 0 ? '信頼度：↓' : null;
    const systemAfter =
      trustLine && !existingSystemAfter.includes(trustLine)
        ? [...existingSystemAfter, trustLine]
        : existingSystemAfter;

    const nextPayload = {
      ...payload,
      selectedChoiceId: entity.selectedChoiceId,
      trustDeltaApplied: delta,
      trustUpdatedResidentId: residentId,
      trustBefore: before,
      trustAfter: after,
      answeredAt: now,
      systemAfter,
    };

    await putLocal('events' as any, {
      id: consultEvent.id,
      kind: 'consult',
      payload: nextPayload,
      updated_at: now,
      deleted: Boolean(consultEvent.deleted),
    });
  }

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('reladen:request-sync'));
    }
  } catch {
    // noop
  }

  return {
    applied,
    alreadyAnswered: false,
    delta,
    residentId,
    before,
    after,
    selectedChoiceId: entity.selectedChoiceId,
  };
}
