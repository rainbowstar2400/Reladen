// apps/web/lib/db/kv-server.ts
// ※ Server Actions / RSC などサーバ実行専用
import { sbServer } from "@/lib/supabase/server";

export class KvUnauthenticatedError extends Error {
  constructor(message = "認証済みユーザーが取得できませんでした。再ログインしてください。") {
    super(message);
    this.name = "KvUnauthenticatedError";
  }
}

function isAuthError(e: any): boolean {
  const msg = e?.message ?? "";
  const code = e?.code ?? "";
  return (
    (typeof msg === "string" &&
      (msg.includes("JWT") || msg.includes("Auth") || msg.includes("authentication"))) ||
    (typeof code === "string" && (code.includes("auth") || code.includes("JWT")))
  );
}

type Table =
  | "events"
  | "topic_threads"
  | "notifications"
  | "beliefs"
  | "feelings"
  | "residents";

const TABLES_REQUIRING_OWNER: Record<Table, boolean> = {
  events: true,
  feelings: true,
  residents: true,
  topic_threads: true,
  notifications: false,
  beliefs: false,
};

async function ensureOwnerId(sb: ReturnType<typeof sbServer>): Promise<string> {
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) {
    // 既存の Error ではなく、KvUnauthenticatedError を投げる
    throw new KvUnauthenticatedError();
  }
  return data.user.id;
}

export async function putKV(table: Table, rec: any) {
  const sb = sbServer();
  let payload = rec;

  if (TABLES_REQUIRING_OWNER[table]) {
    const ownerId = rec?.owner_id ?? (await ensureOwnerId(sb));
    payload = { ...rec, owner_id: ownerId };
  }

  const { error } = await sb.from(table).upsert(payload, { onConflict: "id" });
  if (error) {
    if (isAuthError(error)) {
      throw new KvUnauthenticatedError();
    }
    throw error;
  }
  return payload;
}

export async function listKV<T = any>(table: Table): Promise<T[]> {
  const sb = sbServer();
  const { data, error } = await sb.from(table).select("*");
  if (error) {
    if (isAuthError(error)) {
      throw new KvUnauthenticatedError();
    }
    throw error;
  }
  return (data as T[]) ?? [];
}
