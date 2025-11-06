// apps/web/app/api/sync/[table]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// use-sync.tsx 側の TABLES と一致させる
const ALLOWED_TABLES = new Set([
  'residents',
  'relations',
  'feelings',
  'events',
  'consult_answers', // ← 追加
] as const);
type Allowed = typeof ALLOWED_TABLES extends Set<infer U> ? U : never;

type IncomingChange = {
  data: any;            // 受け取るが今回は未使用（将来的にPush対応予定）
  updated_at?: string;
  deleted?: boolean;
};

type SyncRequest = {
  // use-sync.tsx から渡ってくる
  since?: string;                 // ISO string / undefined
  changes?: IncomingChange[];     // ローカル差分（今回は無視）
  limit?: number;                 // 任意（未指定可）
  table?: string;                 // fetch 側で付与されるが、URL の [table] を優先
};

function getSbAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) return null;
  return createClient(url, anon, { auth: { persistSession: false } });
}

// Service Role が設定されていれば、受け取った changes をクラウドへ upsert（Push）できる
function getSbService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request, ctx: { params: { table: string } }) {
  try {
    const table = ctx?.params?.table ?? '';
    if (!ALLOWED_TABLES.has(table as Allowed)) {
      return NextResponse.json({ error: `table "${table}" is not allowed` }, { status: 400 });
    }

    const sb = getSbAnon();
    if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

    const body = (await req.json().catch(() => ({}))) as SyncRequest;

    // since: これより新しい updated_at を取得
    const since = body?.since ?? undefined;
    const limit = Math.max(1, Math.min(1000, body?.limit ?? 500));

    // --- Push（任意・Service Role があれば実行） ---
    const incoming = Array.isArray(body?.changes) ? body!.changes! : [];
    if (incoming.length > 0) {
      const srv = getSbService();
      if (srv) {
        const rows = incoming.map((c) => c.data);
        // BaseEntity 形（id, updated_at, deleted ...）を想定。onConflict: 'id'
        // 失敗しても Pull は継続する（エラーは握りつぶし）
        const { error: pushErr } = await srv
          .from(table as any)
          .upsert(rows as any, { onConflict: 'id' });
        // pushErr は握りつぶし（ログ化したければここで console.warn(pushErr) など）
      }
    }

    let q = sb.from(table).select('*').order('updated_at', { ascending: true }).limit(limit);
    if (since) q = q.gt('updated_at', since);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message ?? 'query failed' }, { status: 500 });
    }

    // use-sync.tsx 側の syncPayloadSchema が期待する形に整形：
    // { changes: [ { data: row, updated_at: row.updated_at, deleted: row.deleted } ] }
    const changes = (data ?? []).map((row: any) => ({
      data: row,
      updated_at: row?.updated_at ?? null,
      deleted: !!row?.deleted,
    }));

    return NextResponse.json({ changes }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unexpected error' }, { status: 500 });
  }
}

// CORS (必要なら有効化。外部呼び出し予定がなければ省略可)
export async function OPTIONS() {
  return NextResponse.json({}, { status: 204 });
}
