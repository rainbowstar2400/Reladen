import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

type Resident = {
  id: string;
  name: string;
  mbti: string | null;
  traits: Record<string, unknown>;
  updated_at: string;
  deleted: boolean;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SupabaseのURLまたはService Roleキーが設定されていません (.env を確認してください)');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  try {
    const filePath = resolve(process.cwd(), 'scripts/converted_seed.json');
    const fileContent = await readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent) as { residents?: Resident[] };

    if (!Array.isArray(data.residents) || data.residents.length === 0) {
      console.error('converted_seed.json に住人データが見つかりません');
      process.exit(1);
    }

    const residents = data.residents;
    const { error } = await supabase.from('residents').upsert(residents);

    if (error) {
      console.error('住人データのアップサートに失敗しました:', error.message);
      process.exit(1);
    }

    console.log(`住人データを${residents.length}件アップサートしました`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('スクリプトの実行に失敗しました:', message);
    process.exit(1);
  }
}

main();
