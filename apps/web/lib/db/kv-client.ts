// apps/web/lib/db/kv-client.ts
// ※ ブラウザ実行専用（'use client' を付けると型安全になる）
'use client';

import { putLocal, listLocal } from "@/lib/db-local";

type Table =
  | "events"
  | "topic_threads"
  | "notifications"
  | "beliefs"
  | "feelings"
  | "relations"
  | "world_states";

export async function putKV(table: Table, rec: any) {
  return putLocal(table as any, rec as any);
}

export async function listKV<T = any>(table: Table): Promise<T[]> {
  return (await listLocal(table as any)) as T[];
}
