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

export async function saveConsultAnswer(id: string, selectedChoiceId: string | null) {
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
    // フォールバック（非常時のみ localStorage へ）
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_KEY(id), JSON.stringify({
          id,
          selectedChoiceId: selectedChoiceId ?? null,
          decidedAt: now,
        } as StoredConsultAnswer));
      }
    } catch {
      // noop
    }
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('reladen:request-sync'));
      }
    } catch { /* noop */ }
  }
}