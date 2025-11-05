// apps/web/lib/data/residents-server.ts
'use server';

import { listKV as listAny } from '@/lib/db/kv-server';
import type { Resident } from '@/types';

/**
 * 指定IDの住人をサーバー側で取得。deleted=false のみ返す。
 * residents が KV に格納されている前提。
 */
export async function getResidentsByIds(ids: string[]): Promise<Resident[]> {
  const all = (await listAny('residents')) as unknown as Resident[];
  const set = new Set(ids);
  return (all ?? []).filter(r => !r.deleted && set.has(r.id));
}
