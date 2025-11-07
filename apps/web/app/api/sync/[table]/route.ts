// apps/web/app/api/sync/[table]/route.ts
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { syncRequestSchema, syncResponseSchema, allowedTables, type AllowedTable } from '@/lib/schemas/server/sync';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

/** リクエストの Authorization を伝播して「ユーザーとして」操作する */
function createAuthedClient(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authz ? { Authorization: authz } : {} },
  });
}

function jsonWithHeaders(data: unknown, status = 200, requestId?: string) {
  const headers = new Headers();
  headers.set('X-Server-Time', new Date().toISOString());
  if (requestId) headers.set('X-Request-Id', requestId);
  return new Response(JSON.stringify(data), { status, headers });
}

export async function POST(req: NextRequest, { params }: { params: { table: string } }) {
  const started = Date.now();
  const requestId = randomUUID();
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  let table: AllowedTable | string = params.table;

  const sb = createAuthedClient(req);

  try {
    // ---- 入力パース（URLのtableとBodyのtable整合もチェック） ----
    const body = await req.json().catch(() => ({}));
    const parsed = syncRequestSchema.safeParse({ ...body, table });

    if (!parsed.success) {
      const errors = parsed.error.flatten();
      console.error(JSON.stringify({
        lvl: 'warn', at: 'sync.parse', requestId, clientIp, userAgent,
        table, errors,
      }));
      return jsonWithHeaders({ message: 'invalid payload', errors }, 400, requestId);
    }

    ({ table } = parsed.data); // 型的に絞る
    if (!allowedTables.includes(table as AllowedTable)) {
      return jsonWithHeaders({ message: 'table not allowed' }, 400, requestId);
    }

    // ---- クライアントからの変更（push）を反映 ----
    const incoming = parsed.data.changes ?? [];
    let pushed = 0;
    if (incoming.length > 0) {
      const rows = incoming.map((c) => {
        // LWW用に updated_at をそのまま採用する（衝突はDB/ポリシー側で解決）
        const d = c.data as Record<string, any>;
        // tombstone運用：deleted を持たせる（無ければfalse）
        if (typeof d.deleted !== 'boolean') d.deleted = !!c.deleted;
        return d;
      });

      const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
      if (error) {
        const msg = error.message || '';
        const isAuth = /JWT|permission|RLS|row level/i.test(msg);
        throw new Response(JSON.stringify({ message: `upsert failed: ${msg}` }), { status: isAuth ? 401 : 400 });
      }
      pushed = rows.length;
    }

    // ---- クラウドの変更（pull）を返す ----
    // since がある場合のみ差分取得。無ければ「最新N件」などにしてもOK（ここではsince優先）
    const since = (parsed.data.since && new Date(parsed.data.since).toISOString()) || null;

    let cloud = [] as any[];
    if (since) {
      const { data, error } = await sb.from(table).select('*').gte('updated_at', since);
      if (error) {
        const msg = error.message || '';
        const isAuth = /JWT|permission|RLS|row level/i.test(msg);
        throw new Response(JSON.stringify({ message: `select failed: ${msg}` }), { status: isAuth ? 401 : 400 });
      }
    } else {
      // since未指定時の方針：初回は一旦空返却（全件取得を避ける）
      cloud = [];
    }

    const resp = syncResponseSchema.parse({
      table,
      changes: cloud.map((row) => ({
        data: row,
        updated_at: row.updated_at,
        deleted: !!row.deleted,
      })),
    });

    const durationMs = Date.now() - started;
    console.log(JSON.stringify({
      lvl: 'info', at: 'sync.ok', requestId, clientIp, userAgent,
      table, pushed, pulled: resp.changes.length, durationMs,
    }));

    return jsonWithHeaders(resp, 200, requestId);
  } catch (e: any) {
    const durationMs = Date.now() - started;
    const status = e instanceof Response ? e.status : 500;
    const message = e instanceof Response ? 'upstream error' : (e?.message ?? 'internal error');
    console.error(JSON.stringify({
      lvl: 'error', at: 'sync.fail', requestId, clientIp, userAgent,
      table, durationMs, status, message,
    }));
    if (e instanceof Response) return e; // 401/400 をそのまま返す
    return jsonWithHeaders({ message: 'internal error', requestId }, 500, requestId);
  }

}
