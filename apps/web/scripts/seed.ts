import { createClient } from '@supabase/supabase-js';
import { newId } from '../lib/newId';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('SupabaseのURLまたはService Roleキーが設定されていません (.env を確認してください)');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function seed() {
  const now = new Date().toISOString();
  const residents = [
    { id: newId(), name: 'アカリ', mbti: 'INFP', traits: { likes: ['紅茶'], hobby: '散歩' }, updated_at: now, deleted: false },
    { id: newId(), name: 'リク', mbti: 'ENTJ', traits: { likes: ['バトル'], hobby: 'トレーニング' }, updated_at: now, deleted: false },
  ];

  const { error: residentError } = await supabase.from('residents').upsert(residents);
  if (residentError) throw residentError;

  const relation = {
    id: newId(),
    a_id: residents[0].id < residents[1].id ? residents[0].id : residents[1].id,
    b_id: residents[0].id < residents[1].id ? residents[1].id : residents[0].id,
    type: 'friend',
    updated_at: now,
    deleted: false,
  };
  const { error: relationError } = await supabase.from('relations').upsert(relation);
  if (relationError) throw relationError;

  const feelings = [
    { id: newId(), from_id: residents[0].id, to_id: residents[1].id, label: 'curious', updated_at: now, deleted: false },
    { id: newId(), from_id: residents[1].id, to_id: residents[0].id, label: 'like', updated_at: now, deleted: false },
  ];
  const { error: feelingsError } = await supabase.from('feelings').upsert(feelings);
  if (feelingsError) throw feelingsError;

  const event = {
    id: newId(),
    kind: 'seed_created',
    payload: { residents: residents.map((r) => r.name) },
    updated_at: now,
    deleted: false,
  };
  const { error: eventsError } = await supabase.from('events').upsert(event);
  if (eventsError) throw eventsError;

  console.log('サンプルデータの投入が完了しました');
}

seed().catch((error) => {
  console.error('シードに失敗しました', error);
  process.exit(1);
});
