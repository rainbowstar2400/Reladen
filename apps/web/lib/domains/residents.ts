// apps/web/lib/domain/residents.ts
// UI はこの関数群“だけ”を使う想定。
// 後で保存先を差し替えるため、ここから先は直接 IndexedDB/Supabase を触らない。

import type { Resident } from '@/../../packages/shared/types';

export async function listResidents(): Promise<Resident[]> {
  // TODO: 実装（db-local or Supabase 経由）
  return [];
}

export async function createResident(_input: Partial<Resident>): Promise<Resident> {
  // TODO: 実装
  return {} as Resident;
}

export async function updateResident(_id: string, _patch: Partial<Resident>): Promise<Resident> {
  // TODO: 実装
  return {} as Resident;
}
