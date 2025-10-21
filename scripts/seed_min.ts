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
type SeedData = {
  residents: Resident[];
  relations?: any[];
  feelings?: any[];
  events?: any[];
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

// 8) いったん住人だけ upsert（5人想定）
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

  // relations/feelings/events は今はスキップ（後で追加する想定）
  console.log('relations / feelings / events は今回は投入していません');
}

main().catch((e) => {
  console.error('seed_min 実行中に例外が発生:', e);
  process.exit(1);
});
