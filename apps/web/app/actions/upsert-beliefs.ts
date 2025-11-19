// apps/web/app/actions/upsert-beliefs.ts
'use server';

import 'server-only';
import { sbServer } from '@/lib/supabase/server';
import { getUserOrThrow } from '@/lib/supabase/get-user';
import { withRetry } from '@/lib/utils/with-retry';
import type { Database, Json } from '@/lib/supabase/types';

export type UpsertBeliefInput = Array<{
  residentId: string;
  worldFacts?: Json;
  personKnowledge?: Json;
}>;

/**
 * 評価結果から得た newBeliefs を Supabase に反映する。
 * - RLS: owner_id = auth.uid() の行のみ参照・更新
 * - 既存があれば upsert で上書き
 * - 更新タイムスタンプを now() に合わせる
 */
export async function upsertBeliefs(inputs: UpsertBeliefInput): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!Array.isArray(inputs) || inputs.length === 0) return { ok: true };

  const user = await getUserOrThrow();
  const sb = sbServer();
  const now = new Date().toISOString();

  for (const b of inputs) {
    // 既存行の存在チェック（owner_id + resident_id）
    const { data: existing, error: selErr } = await sb
      .from('beliefs')
      .select('id, world_facts, person_knowledge')
      .eq('owner_id', user.id)
      .eq('resident_id', b.residentId)
      .maybeSingle();

    if (selErr) return { ok: false, reason: `select failed: ${selErr.message}` };

    // マージ（既存があれば deep merge でも良いが、まずは上書きで十分）
    const worldFacts: Json = b.worldFacts ?? existing?.world_facts ?? ([] as Json);
    const personKnowledge: Json = b.personKnowledge ?? existing?.person_knowledge ?? ({} as Json);

    const row = {
      id: existing?.id, // upsert で指定
      resident_id: b.residentId,
      world_facts: worldFacts,
      person_knowledge: personKnowledge,
      updated_at: now,
      deleted: false,
      owner_id: user.id,
    } satisfies Database['public']['Tables']['beliefs']['Insert'];

    const { error: upErr } = await withRetry(async () => {
      const res = await sb.from('beliefs').upsert(row).select().maybeSingle();
      if (res.error) throw res.error;
      return res;
    });
  }

  return { ok: true };
}
