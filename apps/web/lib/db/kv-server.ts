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

type SoftDeleteTable =
  | "events"
  | "consult_answers"
  | "feelings"
  | "residents"
  | "presets"
  | "relations"
  | "world_states"
  | "nicknames"
  | "player_profiles"
  | "topic_threads"
  | "shared_snippets"
  | "recent_events"
  | "offscreen_knowledge";

type NonDeleteTable = "notifications";

type Table = SoftDeleteTable | NonDeleteTable;

type OwnerColumnConfig =
  | { type: "fixed"; column: string }
  | { type: "candidates"; columns: string[] };

const TABLE_OWNER_COLUMNS: Partial<Record<Table, OwnerColumnConfig>> = {
  consult_answers: { type: "fixed", column: "owner_id" },
  events: { type: "fixed", column: "owner_id" },
  feelings: { type: "fixed", column: "owner_id" },
  residents: { type: "fixed", column: "owner_id" },
  notifications: { type: "fixed", column: "owner_id" },
  topic_threads: { type: "fixed", column: "owner_id" },
  presets: { type: "fixed", column: "owner_id" },
  relations: { type: "fixed", column: "owner_id" },
  world_states: { type: "fixed", column: "owner_id" },
  shared_snippets: { type: "fixed", column: "owner_id" },
  recent_events: { type: "fixed", column: "owner_id" },
  offscreen_knowledge: { type: "fixed", column: "owner_id" },
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
    const { error } = await sb.from(table as any).select(column).limit(1);
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

  const { error } = await sb.from(table as any).upsert(payload, { onConflict: "id" });
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
  const { data, error } = await sb.from(table as any).select("*");
  if (error) {
    if (isAuthError(error)) {
      throw new KvUnauthenticatedError();
    }
    throw error;
  }
  return (data as T[]) ?? [];
}

export async function getKV<T = any>(table: SoftDeleteTable, id: string): Promise<T | null> {
  const sb = sbServer();
  const { data, error } = await sb
    .from(table as any)
    .select("*")
    .eq("id", id)
    .eq("deleted", false)
    .maybeSingle();
  if (error) {
    if (isAuthError(error)) {
      throw new KvUnauthenticatedError();
    }
    throw error;
  }
  return (data as T) ?? null;
}

export async function getRawKV<T = any>(table: Table, id: string): Promise<T | null> {
  const sb = sbServer();
  const { data, error } = await sb
    .from(table as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isAuthError(error)) {
      throw new KvUnauthenticatedError();
    }
    throw error;
  }
  return (data as T) ?? null;
}

type ListActiveFilter = {
  column: string;
  op: "eq" | "gt" | "lt" | "gte" | "lte";
  value: any;
};

type ListActiveOptions = {
  limit?: number;
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
};

export async function listActiveKV<T = any>(
  table: SoftDeleteTable,
  filters?: ListActiveFilter[],
  options?: ListActiveOptions,
): Promise<T[]> {
  const sb = sbServer();
  let query = sb.from(table as any).select("*").eq("deleted", false);

  if (filters) {
    for (const f of filters) {
      switch (f.op) {
        case "eq":
          query = query.eq(f.column, f.value);
          break;
        case "gt":
          query = query.gt(f.column, f.value);
          break;
        case "lt":
          query = query.lt(f.column, f.value);
          break;
        case "gte":
          query = query.gte(f.column, f.value);
          break;
        case "lte":
          query = query.lte(f.column, f.value);
          break;
      }
    }
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true,
    });
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    if (isAuthError(error)) {
      throw new KvUnauthenticatedError();
    }
    throw error;
  }
  return (data as T[]) ?? [];
}

