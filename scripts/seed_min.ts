// 1) .env 読み込み
import 'dotenv/config';

// 2) 依存
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// 3) .env 取得（URL/KEY）
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SupabaseのURLまたはService Roleキーが設定されていません (.env を確認してください)');
  process.exit(1);
}

// 4) Supabase クライアント
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 5) JSON 読み込み
const inputPath = path.resolve(process.cwd(), 'scripts', 'converted_seed.json');
if (!fs.existsSync(inputPath)) {
  console.error(`converted_seed.json が見つかりません: ${inputPath}`);
  process.exit(1);
}
const raw = fs.readFileSync(inputPath, 'utf-8');

// 6) 型のざっくり定義と parse
type Resident = {
  id?: string;
  name: string;
  mbti?: string | null;
  traits?: Record<string, unknown>;
  updated_at?: string;
  deleted?: boolean;
};
type Relation = {
  id?: string;
  a: string;         // 住人ID（旧IDの可能性あり）
  b: string;         // 住人ID（旧IDの可能性あり）
  label?: string | null;
  updated_at?: string;
  deleted?: boolean;
};
type Feeling = {
  id?: string;
  from: string;      // 住人ID（旧IDの可能性あり）
  to: string;        // 住人ID（旧IDの可能性あり）
  label?: string | null;
  score?: number | null;
  updated_at?: string;
  deleted?: boolean;
};
type EventRow = {
  id?: string;
  kind: string;                // 'consult' | 'conversation' | ...
  payload?: any;
  occurredAt?: string | null;  // timestamptz
  updated_at?: string;
  deleted?: boolean;
};
type SeedData = {
  residents: Resident[];
  relations?: Relation[];
  feelings?: Feeling[];
  events?: EventRow[];
};

let data: SeedData;
try {
  data = JSON.parse(raw) as SeedData;
} catch (e) {
  console.error('converted_seed.json のパースに失敗しました:', e);
  process.exit(1);
}
if (!Array.isArray(data.residents)) {
  console.error('converted_seed.json の "residents" が配列ではありません');
  process.exit(1);
}

// 7) UUID 付与＆フィールド補完
const isUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const idMap = new Map<string, string>();
for (const r of data.residents) {
  const oldId = r.id ?? '';
  if (!oldId || !isUUID(oldId)) {
    const newId = randomUUID();
    if (oldId) idMap.set(oldId, newId);
    r.id = newId;
  }
  if (r.mbti === undefined) r.mbti = null;
  if (!r.traits) r.traits = {};
  r.updated_at = new Date().toISOString();
  r.deleted = false;
}

// 8) 住人以外の参照IDを idMap で置換する補助
function mapId(oldOrNew: string): string {
  if (!oldOrNew) return oldOrNew;
  const mapped = idMap.get(oldOrNew);
  return mapped ?? oldOrNew;
}

function ensureUuid(id?: string): string {
  return id && isUUID(id) ? id : randomUUID();
}

function normalizeRelations(input?: Relation[]): Relation[] {
  if (!Array.isArray(input)) return [];
  const now = new Date().toISOString();
  return input.map((r) => ({
    id: ensureUuid(r.id),
    a: mapId(r.a),
    b: mapId(r.b),
    label: r.label ?? null,
    updated_at: now,
    deleted: false,
  }));
}

function normalizeFeelings(input?: Feeling[]): Feeling[] {
  if (!Array.isArray(input)) return [];
  const now = new Date().toISOString();
  return input.map((f) => ({
    id: ensureUuid(f.id),
    from: mapId(f.from),
    to: mapId(f.to),
    label: f.label ?? null,
    score: typeof f.score === 'number' ? f.score : null,
    updated_at: now,
    deleted: false,
  }));
}

function normalizeEvents(input?: EventRow[]): EventRow[] {
  if (!Array.isArray(input)) return [];
  const now = new Date().toISOString();
  return input.map((e) => {
    // payload の中に住人IDが含まれる一般的な場所（任意項目）も軽く置換を試みる
    const p = e.payload ?? {};
    // 例: participants: ['A','B'] / speaker: 'C' / residentId: 'A' などを置換
    if (Array.isArray(p.participants)) {
      p.participants = p.participants.map((x: any) =>
        typeof x === 'string' ? mapId(x) : x
      );
    }
    if (typeof p.speaker === 'string') {
      p.speaker = mapId(p.speaker);
    }
    if (typeof p.residentId === 'string') {
      p.residentId = mapId(p.residentId);
    }
    // choices はそのまま通す（構造はアプリ側で解釈）

    return {
      id: ensureUuid(e.id),
      kind: e.kind,
      payload: p,
      occurredAt: e.occurredAt ?? now,
      updated_at: now,
      deleted: false,
    };
  });
}

// 9) upsert 共通ヘルパ
async function upsertOrExit<T extends object>(
  table: string,
  rows: T[],
  onConflict = 'id'
) {
  if (!rows.length) {
    console.log(`${table}: データ無しのためスキップ`);
    return;
  }
  const { error } = await supabase.from(table).upsert(rows as any, { onConflict });
  if (error) {
    console.error(`${table} のアップサートに失敗しました:`, error.message);
    process.exit(1);
  }
  console.log(`✓ ${table} upsert 完了 (${rows.length}件)`);
}

// 10) シード本体
async function main() {
  console.log(`residents を upsert します（${data.residents.length}件）`);
  const { error } = await supabase
    .from('residents')
    .upsert(data.residents, { onConflict: 'id' });

  if (error) {
    console.error('住人データのアップサートに失敗しました:', error.message);
    process.exit(1);
  }
  console.log('住人 upsert 完了');

  // relations / feelings / events も投入
  const relations = normalizeRelations(data.relations);
  await upsertOrExit('relations', relations);

  const feelings = normalizeFeelings(data.feelings);
  await upsertOrExit('feelings', feelings);

  const events = normalizeEvents(data.events);
  await upsertOrExit('events', events);

  console.log('✓ seed_min: すべての upsert が完了しました');
}

main().catch((e) => {
  console.error('seed_min 実行中に例外が発生:', e);
  process.exit(1);
});
