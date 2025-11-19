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

type OwnerColumnConfig =
  | { type: "fixed"; column: string }
  | { type: "candidates"; columns: string[] };

const TABLE_OWNER_COLUMNS: Partial<Record<Table, OwnerColumnConfig>> = {
  events: { type: "fixed", column: "owner_id" },
  feelings: { type: "fixed", column: "owner_id" },
  residents: { type: "fixed", column: "owner_id" },
  // topic_threads だけスキーマが異なる可能性があるため候補を列挙し、
  // 実際に存在するカラムを Supabase に問い合わせて判定する。
  topic_threads: {
    type: "candidates",
    columns: ["user_id", "profile_id", "created_by", "owner", "owner_id"],
  },
};

const ownerColumnCache = new Map<Table, string | null>();

async function resolveOwnerColumn(
  sb: ReturnType<typeof sbServer>,
  table: Table,
): Promise<string | null> {
  if (ownerColumnCache.has(table)) {
    return ownerColumnCache.get(table)!;
  }

  const config = TABLE_OWNER_COLUMNS[table];
  if (!config) {
    ownerColumnCache.set(table, null);
    return null;
  }

  if (config.type === "fixed") {
    ownerColumnCache.set(table, config.column);
    return config.column;
  }

  for (const column of config.columns) {
    const { error } = await sb.from(table).select(column).limit(1);
    if (!error) {
      ownerColumnCache.set(table, column);
      return column;
    }
    const message = error?.message ?? "";
    if (!/column .* does not exist/i.test(message)) {
      throw error;
    }
  }

  ownerColumnCache.set(table, null);
  throw new Error(`Owner column not found for table ${table}.`);
}

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

  const ownerColumn = await resolveOwnerColumn(sb, table);

  if (ownerColumn) {
    const currentOwner = rec?.[ownerColumn];
    const ownerId = currentOwner ?? (await ensureOwnerId(sb));
    payload = { ...rec, [ownerColumn]: ownerId };
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
