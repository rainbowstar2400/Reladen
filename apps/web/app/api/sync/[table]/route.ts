// apps/web/app/api/sync/[table]/route.ts

export const runtime = 'nodejs'; // ← 追加：Edge事故回避

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { syncRequestSchema, syncResponseSchema, allowedTables, type AllowedTable } from '@/lib/schemas/server/sync';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

function jsonWithHeaders(data: unknown, status = 200, requestId?: string) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');            // ★ 明示
  headers.set('X-Server-Time', new Date().toISOString());
  if (requestId) headers.set('X-Request-Id', requestId);
  return new Response(JSON.stringify(data), { status, headers });
}

// リクエスト毎に Authorization を伝播
function createAuthedClient(req: NextRequest) {
  const authz = req.headers.get('authorization') || '';
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: authz ? { Authorization: authz } : {} },
  });
}

// Supabaseエラーを 400/401 に成形
function asHttpError(prefix: string, err: any) {
  const m = err?.message ?? String(err);
  const isAuth = /JWT|permission|RLS|row level|authorization/i.test(m);
  const status = isAuth ? 401 : 400;
  return jsonWithHeaders({ message: `${prefix}: ${m}` }, status);
}

// residents の許可カラム（DBにあるものだけ）
const RESIDENTS_ALLOWED = new Set(['id','name','updated_at','deleted','owner_id']);

export async function POST(req: NextRequest, { params }: { params: { table: string } }) {
  const started = Date.now();
  const requestId = randomUUID();
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  let table: AllowedTable | string = params.table;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonWithHeaders({ message: 'supabase env missing' }, 500, requestId);
  }

  const sb = createAuthedClient(req);

  try {
    // --- 入力 ---
    const body = await req.json().catch(() => ({}));
    const parsed = syncRequestSchema.safeParse({ ...body, table });
    if (!parsed.success) {
      const errors = parsed.error.flatten();
      return jsonWithHeaders({ message: 'invalid payload', errors }, 400, requestId);
    }
    ({ table } = parsed.data);
    if (!allowedTables.includes(table as AllowedTable)) {
      return jsonWithHeaders({ message: 'table not allowed' }, 400, requestId);
    }

    // --- push (upsert) ---
    const incoming = parsed.data.changes ?? [];
    let pushed = 0;
    if (incoming.length > 0) {
      const rows = incoming.map((c) => {
        const d = { ...(c.data as Record<string, any>) };
        if (typeof d.deleted !== 'boolean') d.deleted = !!c.deleted;

        if (table === 'residents') {
          // 1) まず camelCase のクライアント専用フィールドを除去
          delete d.activityTendency;
          delete d.sleepProfile;
          // 2) 念のためホワイトリストでフィルタ
          for (const k of Object.keys(d)) {
            if (!RESIDENTS_ALLOWED.has(k)) delete d[k];
          }
        }
        return d;
      });

      const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
      if (error) throw asHttpError('upsert failed', error);
      pushed = rows.length;
    }

    // --- pull (select) ---
    const since = (parsed.data.since && new Date(parsed.data.since).toISOString()) || null;
    let cloud: any[] = [];
    if (since) {
      const { data, error } = await sb.from(table).select('*').gte('updated_at', since);
      if (error) throw asHttpError('select failed', error);
      cloud = data ?? [];
    } else {
      cloud = []; // 初回は全件返さない方針
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
    console.log(JSON.stringify({ lvl:'info', at:'sync.ok', requestId, clientIp, userAgent, table, pushed, pulled: resp.changes.length, durationMs }));
    return jsonWithHeaders(resp, 200, requestId);
  } catch (e: any) {
    const durationMs = Date.now() - started;
    const isResp = e instanceof Response;
    const status = isResp ? e.status : 500;
    let body = { message: 'internal error', requestId };
    if (isResp) {
      try { body = JSON.parse(await e.text()); } catch { body = { message: 'upstream error', requestId }; }
    }
    console.error(JSON.stringify({ lvl:'error', at:'sync.fail', requestId, clientIp, userAgent, table, durationMs, status, body, stack: e?.stack }));
    return jsonWithHeaders(body, status, requestId); // ★ 常に本文を返す
  }
}
