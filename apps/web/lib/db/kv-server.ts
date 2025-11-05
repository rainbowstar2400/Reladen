// apps/web/lib/db/kv-server.ts
// ※ Server Actions / RSC などサーバ実行専用
import { sbServer } from "@/lib/supabase/server";

type Table =
  | "events"
  | "topic_threads"
  | "notifications"
  | "beliefs"
  | "feelings";

export async function putKV(table: Table, rec: any) {
  const sb = sbServer();
  const { error } = await sb.from(table).upsert(rec, { onConflict: "id" });
  if (error) throw error;
  return rec;
}

export async function listKV<T = any>(table: Table): Promise<T[]> {
  const sb = sbServer();
  const { data, error } = await sb.from(table).select("*");
  if (error) throw error;
  return (data as T[]) ?? [];
}
