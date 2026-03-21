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
  const isAuth = /JWT|permission|RLS|row level|row-level|authorization/i.test(m);
  const status = isAuth ? 401 : 400;
  return jsonWithHeaders({ message: `${prefix}: ${m}` }, status);
}

function pickFirst<T>(...values: Array<T | null | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function parseDateMs(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function resolveIncomingUpdatedAt(incomingData: Record<string, any>, fallbackUpdatedAt?: string): string {
  const candidate = pickFirst(
    incomingData.updated_at,
    incomingData.updatedAt,
    incomingData.updatedat,
    fallbackUpdatedAt,
  );
  const candidateMs = parseDateMs(candidate);
  if (candidateMs !== null) {
    const normalized = new Date(candidateMs).toISOString();
    incomingData.updated_at = normalized;
    return normalized;
  }
  const now = new Date().toISOString();
  incomingData.updated_at = now;
  return now;
}

function shouldApplyIncomingByLww(currentUpdatedAt: unknown, incomingUpdatedAt: unknown): boolean {
  const incomingMs = parseDateMs(incomingUpdatedAt);
  if (incomingMs === null) return false;
  const currentMs = parseDateMs(currentUpdatedAt);
  if (currentMs === null) return true;
  // 同値時は既存優先 no-op。incoming が新しい時のみ採用。
  return incomingMs > currentMs;
}

function isUniqueViolation(error: any): boolean {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');
  return code === '23505' || /duplicate key value violates unique constraint/i.test(message);
}

function buildConsultAnswerPayload(
  incomingData: Record<string, any>,
  allowedCols: Set<string>,
  fallbackUpdatedAt?: string,
) {
  const payload: Record<string, any> = {};
  const id = incomingData.id;
  const updatedAt = pickFirst(
    incomingData.updated_at,
    incomingData.updatedAt,
    incomingData.updatedat,
    fallbackUpdatedAt,
  );
  const selectedChoiceId = pickFirst(
    incomingData.selectedChoiceId,
    incomingData.selected_choice_id,
    incomingData.selectedchoiceid,
  );
  const decidedAt = pickFirst(
    incomingData.decidedAt,
    incomingData.decided_at,
    incomingData.decidedat,
  );

  if (id && allowedCols.has('id')) payload.id = id;
  if (allowedCols.has('updated_at')) {
    payload.updated_at =
      typeof updatedAt === 'string' && updatedAt.length > 0 ? updatedAt : new Date().toISOString();
  }
  if (typeof incomingData.deleted === 'boolean' && allowedCols.has('deleted')) {
    payload.deleted = incomingData.deleted;
  }

  if (allowedCols.has('selected_choice_id')) payload.selected_choice_id = selectedChoiceId ?? null;
  if (allowedCols.has('decided_at')) payload.decided_at = decidedAt ?? null;

  return payload;
}

function normalizeConsultAnswerRowForResponse(row: Record<string, any>) {
  const normalized = { ...row };
  const selectedChoiceId = pickFirst(
    normalized.selected_choice_id,
    normalized.selectedChoiceId,
    normalized.selectedchoiceid,
  );
  const decidedAt = pickFirst(
    normalized.decided_at,
    normalized.decidedAt,
    normalized.decidedat,
  );
  if (selectedChoiceId !== undefined) normalized.selected_choice_id = selectedChoiceId;
  if (decidedAt !== undefined) normalized.decided_at = decidedAt;
  delete normalized.selectedchoiceid;
  delete normalized.decidedat;
  delete normalized.selectedChoiceId;
  delete normalized.decidedAt;
  return normalized;
}

async function pushConsultAnswersRows(args: {
  sb: ReturnType<typeof createAuthedClient>;
  table: AllowedTable;
  incoming: Array<{ data: Record<string, any>; updated_at?: string; deleted?: boolean }>;
  allowedCols: Set<string>;
  ownerId: string;
}) {
  const { sb, table, incoming, allowedCols, ownerId } = args;
  let pushed = 0;

  for (const change of incoming) {
    const incomingData = { ...(change.data ?? {}) };
    resolveIncomingUpdatedAt(incomingData, change.updated_at);
    if (incomingData.deleted == null && typeof change.deleted === 'boolean') {
      incomingData.deleted = change.deleted;
    }
    if (!incomingData.id) continue;

    const payload = buildConsultAnswerPayload(incomingData, allowedCols, change.updated_at);
    if (allowedCols.has('owner_id')) payload.owner_id = ownerId;
    const { error } = await sb.from(table).insert(payload);
    if (!error) {
      pushed += 1;
      continue;
    }
    if (isUniqueViolation(error)) {
      // first-write-wins: 既存回答が正。後着は no-op 扱い。
      continue;
    }
    throw asHttpError('insert failed', error);
  }

  return pushed;
}

async function fetchExistingUpdatedAtById(args: {
  sb: ReturnType<typeof createAuthedClient>;
  table: AllowedTable;
  ids: string[];
}) {
  const uniqueIds = [...new Set(args.ids.filter((id) => typeof id === 'string' && id.length > 0))];
  if (uniqueIds.length === 0) return new Map<string, string>();

  const { data, error } = await args.sb.from(args.table).select('id,updated_at').in('id', uniqueIds);
  if (error) throw asHttpError('select failed', error);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (typeof row?.id !== 'string') continue;
    if (typeof row?.updated_at === 'string') {
      map.set(row.id, row.updated_at);
    }
  }
  return map;
}

// 許可リストを DB の snake_case カラム名に統一する

// residents の許可カラム（DBにあるものだけ）
const RESIDENTS_ALLOWED = new Set([
  'id', 'name', 'updated_at', 'deleted', 'owner_id',
  'mbti', 'traits', 'speech_preset', 'gender', 'age',
  'birthday', 'occupation', 'first_person', 'interests', 'sleep_profile',
  'trust_to_player', 'nickname_tendency'
]);

// relations の許可カラム
const RELATIONS_ALLOWED = new Set([
  'id', 'a_id', 'b_id', 'type', 'updated_at', 'deleted', 'owner_id', 'family_sub_type'
]);

// feelings の許可カラム
const FEELINGS_ALLOWED = new Set([
  'id', 'from_id', 'to_id', 'label', 'score', 'updated_at', 'deleted', 'owner_id',
  'recent_deltas', 'last_contacted_at', 'base_label', 'special_label', 'base_before_special'
]);

// nicknames の許可カラム
const NICKNAMES_ALLOWED = new Set([
  'id', 'from_id', 'to_id', 'nickname', 'updated_at', 'deleted', 'owner_id', 'locked'
]);

// events の許可カラム
const EVENTS_ALLOWED = new Set([
  'id', 'kind', 'payload', 'updated_at', 'deleted', 'owner_id'
]);

// presets の許可カラム
const PRESETS_ALLOWED = new Set([
  'id', 'category', 'label', 'description', 'example',
  'is_managed', 'owner_id', 'updated_at', 'deleted',
  'speech_profile_data',
]);

// world_states の許可カラム
const WORLD_STATES_ALLOWED = new Set([
  'id', 'weather_current', 'weather_quiet_hours', 'weather_comment',
  'owner_id', 'updated_at', 'deleted'
]);

// consult_answers の内部契約は snake_case に統一する
const CONSULT_ANSWERS_ALLOWED = new Set([
  'id',
  'updated_at',
  'deleted',
  'selected_choice_id',
  'decided_at',
]);

// 許可リストのマップ (キーは sync.ts と一致)
const ALLOWED_COLUMNS_MAP: Record<AllowedTable, Set<string>> = {
  residents: RESIDENTS_ALLOWED,
  relations: RELATIONS_ALLOWED,
  feelings: FEELINGS_ALLOWED,
  nicknames: NICKNAMES_ALLOWED,
  events: EVENTS_ALLOWED,
  presets: PRESETS_ALLOWED,
  consult_answers: CONSULT_ANSWERS_ALLOWED,
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

      // consult_answers は first-write-wins を守るため専用処理（insert + duplicate no-op）
      if (table === 'consult_answers') {
        pushed = await pushConsultAnswersRows({
          sb,
          table: table as AllowedTable,
          incoming: incoming as Array<{ data: Record<string, any>; updated_at?: string; deleted?: boolean }>,
          allowedCols,
          ownerId: user.id,
        });
      // 2. 許可リストが空の場合は upsert をスキップ
      } else if (allowedCols.size === 0) {
        console.warn(JSON.stringify({ lvl: 'warn', at: 'sync.skip', requestId, table, reason: 'allowed columns list is empty' }));
      } else {
        // 3. 許可リストがある場合、キーを変換して upsert
        const rowsWithMeta = incoming.map((c) => {
          const incomingData = { ...(c.data as Record<string, any>) }; // camelCase キー
          const payload: Record<string, any> = {}; // snake_case キー
          const resolvedUpdatedAt = resolveIncomingUpdatedAt(incomingData, c.updated_at);

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
          if (allowedCols.has('updated_at')) {
            payload.updated_at = resolvedUpdatedAt;
          }

          // 9. owner_id は対象テーブルが許可する場合のみ注入
          if (allowedCols.has('owner_id')) {
            payload.owner_id = user.id;
          }

          return {
            payload, // 最終的な payload は snake_case のキーを持つ
            id: typeof payload.id === 'string' ? payload.id : null,
            updatedAt: resolvedUpdatedAt,
          };
        });

        const ids = rowsWithMeta
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        const existingUpdatedAtById = await fetchExistingUpdatedAtById({
          sb,
          table: table as AllowedTable,
          ids,
        });

        const rows = rowsWithMeta
          .filter((row) => {
            if (!row.id) return true;
            const currentUpdatedAt = existingUpdatedAtById.get(row.id);
            if (!currentUpdatedAt) return true;
            return shouldApplyIncomingByLww(currentUpdatedAt, row.updatedAt);
          })
          .map((row) => row.payload);

        // 10. upsert (snake_case のデータを送信)
        if (rows.length > 0) {
          const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' });
          if (error) throw asHttpError('upsert failed', error);
        }
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
        data: table === 'consult_answers'
          ? normalizeConsultAnswerRowForResponse(row as Record<string, any>)
          : row, // DBからは snake_case で返る (client-side Drizzle が処理する)
        updated_at: row.updated_at,
        deleted: !!row.deleted,
      })),
    });

    const durationMs = Date.now() - started;
    console.log(JSON.stringify({ lvl: 'info', at: 'sync.ok', requestId, clientIp, userAgent, table, pushed, pulled: resp.changes.length, durationMs }));
    return jsonWithHeaders(resp, 200, requestId);
  } catch (e: any) {
    const durationMs = Date.now() - started;
    const isResp =
      e instanceof Response ||
      (typeof e === 'object' &&
        e !== null &&
        typeof e.status === 'number' &&
        typeof e.text === 'function');
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
