// apps/web/app/api/sync/[table]/route.ts

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { syncRequestSchema, syncResponseSchema, allowedTables, type AllowedTable } from '@/lib/schemas/server/sync';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

function jsonWithHeaders(data: unknown, status = 200, requestId?: string) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
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

// 許可リストを DB の snake_case カラム名に統一する

// residents の許可カラム（DBにあるものだけ）
const RESIDENTS_ALLOWED = new Set([
  'id', 'name', 'updated_at', 'deleted', 'owner_id',
  'mbti', 'traits', 'speech_preset', 'gender', 'age',
  'birthday', 'occupation', 'first_person', 'interests', 'sleep_profile'
]);

// relations の許可カラム
const RELATIONS_ALLOWED = new Set([
  'id', 'a_id', 'b_id', 'type', 'updated_at', 'deleted', 'owner_id'
]);

// feelings の許可カラム
const FEELINGS_ALLOWED = new Set([
  'id', 'from_id', 'to_id', 'label', 'score', 'updated_at', 'deleted', 'owner_id'
]);

// nicknames の許可カラム
const NICKNAMES_ALLOWED = new Set([
  'id', 'from_id', 'to_id', 'nickname', 'updated_at', 'deleted', 'owner_id'
]);

// events の許可カラム
const EVENTS_ALLOWED = new Set([
  'id', 'kind', 'payload', 'updated_at', 'deleted', 'owner_id'
]);

// presets の許可カラム
const PRESETS_ALLOWED = new Set([
  'id', 'category', 'label', 'description', 'example',
  'is_managed', 'owner_id', 'updated_at', 'deleted'
]);

// world_states の許可カラム
const WORLD_STATES_ALLOWED = new Set([
  'id', 'weather_current', 'weather_quiet_hours', 'weather_comment',
  'owner_id', 'updated_at', 'deleted'
]);

// 許可リストのマップ (キーは sync.ts と一致)
const ALLOWED_COLUMNS_MAP: Record<AllowedTable, Set<string>> = {
  residents: RESIDENTS_ALLOWED,
  relations: RELATIONS_ALLOWED,
  feelings: FEELINGS_ALLOWED,
  nicknames: NICKNAMES_ALLOWED,
  events: EVENTS_ALLOWED,
  presets: PRESETS_ALLOWED,
  consult_answers: new Set(),
  world_states: WORLD_STATES_ALLOWED,
};

export async function POST(req: NextRequest, { params }: { params: { table: string } }) {
  const started = Date.now();
  const requestId = randomUUID();
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  let table: AllowedTable | string = params.table;

  const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

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

    // RLSポリシーを満たすため、ここでユーザーIDを取得する
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser();
    if (authError || !user) {
      return jsonWithHeaders({ message: 'auth error: ' + (authError?.message ?? 'no user') }, 401, requestId);
    }

    // --- push (upsert) ---
    // push ロジックを汎用化
    const incoming = parsed.data.changes ?? [];
    let pushed = 0;
    if (incoming.length > 0) {

      // 1. snake_case の許可リストを取得
      const allowedCols = ALLOWED_COLUMNS_MAP[table as AllowedTable];

      if (!allowedCols) {
        return jsonWithHeaders({ message: `table ${table} sync not configured` }, 500, requestId);
      }

      // 2. 許可リストが空 (consult_answers など) の場合は upsert をスキップ
      if (allowedCols.size === 0) {
        console.warn(JSON.stringify({ lvl: 'warn', at: 'sync.skip', requestId, table, reason: 'allowed columns list is empty' }));

      } else {
        // 3. 許可リストがある場合、キーを変換して upsert
        const rows = incoming.map((c) => {
          const incomingData = { ...(c.data as Record<string, any>) }; // camelCase キー
          const payload: Record<string, any> = {}; // snake_case キー

          // 4. incomingData (camelCase) をループ
          for (const camelKey of Object.keys(incomingData)) {
            // 5. キーを snake_case に変換
            const snakeKey = camelToSnake(camelKey);

            // 6. 変換後のキーが snake_case 許可リストにあるかチェック
            if (allowedCols.has(snakeKey)) {
              // 7. payload には snake_case のキーで格納
              payload[snakeKey] = incomingData[camelKey];
            }
          }

          // 8. 'id' と 'deleted' はキー変換されないため、手動でチェック
          if (incomingData.id && allowedCols.has('id')) {
            payload.id = incomingData.id;
          }
          if (typeof incomingData.deleted === 'boolean' && allowedCols.has('deleted')) {
            payload.deleted = incomingData.deleted;
          }

          // 9. owner_id を強制上書き
          payload.owner_id = user.id;

          return payload; // 最終的な payload は snake_case のキーを持つ
        });

        // 10. upsert (snake_case のデータを送信)
        const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
        if (error) throw asHttpError('upsert failed', error);
        pushed = rows.length;
      }
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
        data: row, // DBからは snake_case で返る (client-side Drizzle が処理する)
        updated_at: row.updated_at,
        deleted: !!row.deleted,
      })),
    });

    const durationMs = Date.now() - started;
    console.log(JSON.stringify({ lvl: 'info', at: 'sync.ok', requestId, clientIp, userAgent, table, pushed, pulled: resp.changes.length, durationMs }));
    return jsonWithHeaders(resp, 200, requestId);
  } catch (e: any) {
    const durationMs = Date.now() - started;
    const isResp = e instanceof Response;
    const status = isResp ? e.status : 500;
    let body = { message: 'internal error', requestId };
    if (isResp) {
      try {
        body = JSON.parse(await e.text());
      } catch {
        body = { message: 'upstream error', requestId };
      }
    }
    console.error(JSON.stringify({ lvl: 'error', at: 'sync.fail', requestId, clientIp, userAgent, table, durationMs, status, body, stack: e?.stack }));
    return jsonWithHeaders(body, status, requestId);
  }
}
