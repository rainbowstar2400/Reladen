// apps/web/app/api/sync/[table]/route.ts

export const runtime = 'nodejs'; // Edge事故回避

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

// ★ Supabaseエラーを 400/401 に整形（RLS/JWT系は 401）
function asHttpError(prefix: string, err: any) {
  const m = err?.message ?? String(err);
  const isAuth = /JWT|permission|RLS|row level|authorization/i.test(m);
  const status = isAuth ? 401 : 400;
  return new Response(JSON.stringify({ message: `${prefix}: ${m}` }), { status });
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

  // ★ 必須環境変数チェック
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonWithHeaders({ message: 'supabase env missing' }, 500, requestId);
  }

  // ★ 認証付きクライアント
  const sb = createAuthedClient(req);

  try {
    // ---- 入力パース ----
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

    // ---- クライアントからの変更（push）を反映 ----
    const incoming = parsed.data.changes ?? [];
    let pushed = 0;
    if (incoming.length > 0) {
      const rows = incoming.map((c) => {
        const d = { ...(c.data as Record<string, any>) };
        if (typeof d.deleted !== 'boolean') d.deleted = !!c.deleted;

        // ★ residents: DB未定義/命名不一致フィールドを除外（当面の暫定）
        if (table === 'residents') {
          delete d.activityTendency;
          delete d.sleepProfile;
          // 将来: snake_case 保存に切替えるなら下記を有効化 + DB列追加
          // if ('activityTendency' in d) { d.activity_tendency = d.activityTendency; delete d.activityTendency; }
          // if ('sleepProfile' in d)     { d.sleep_profile     = d.sleepProfile;     delete d.sleepProfile;     }
        }
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
    let cloud: any[] = [];
    if (since) {
      const { data, error } = await sb.from(table).select('*').gte('updated_at', since);
      if (error) throw asHttpError('select failed', error);
      cloud = data ?? [];
    } else {
      cloud = []; // 初回全件は避ける方針
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
    console.log(JSON.stringify({ lvl: 'info', at: 'sync.ok', requestId, clientIp, userAgent, table, pushed, pulled: resp.changes.length, durationMs }));

    return jsonWithHeaders(resp, 200, requestId);
  } catch (e: any) {
    const durationMs = Date.now() - started;
    const status = e instanceof Response ? e.status : 500;
    const message = e instanceof Response ? await e.text().catch(() => '') : (e?.message ?? 'internal error');

    console.error(JSON.stringify({ lvl: 'error', at: 'sync.fail', requestId, clientIp, userAgent, table, durationMs, status, message, stack: e?.stack }));

    if (e instanceof Response) return e; // 400/401 をそのまま返す
    return jsonWithHeaders({ message: 'internal error', requestId }, 500, requestId);
  }
}
