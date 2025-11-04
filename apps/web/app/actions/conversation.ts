// apps/web/app/actions/conversation.ts
'use server';
import 'server-only';

import { randomUUID } from 'crypto';
import { StartConversationInput } from '@/lib/schemas/server/conversation';
import { callGptForConversation } from '@/lib/gpt/call-gpt-for-conversation';
import { evaluateConversation } from '@/lib/evaluation/evaluate-conversation';
import { sbServer } from '@/lib/supabase/server';
import { getUserOrThrow } from '@/lib/supabase/get-user';
import type { TopicThread } from '@repo/shared/types/conversation';
import { withRetry } from '@/lib/utils/with-retry';

/** SYSTEM 行の整形 */
function makeSystemLine(out: any, r: any): string {
  const [a, b] = out.participants as [string, string];
  const fmt = (x: number) => (x > 0 ? `+${x}` : `${x}`);
  const imp = (x: number) => (x > 0 ? '↑' : x < 0 ? '↓' : '→');
  return `SYSTEM: ${a}→${b} 好感度 ${fmt(r.deltas.aToB.favor)} / 印象 ${imp(
    r.deltas.aToB.impression
  )} | ${b}→${a} 好感度 ${fmt(r.deltas.bToA.favor)} / 印象 ${imp(r.deltas.bToA.impression)}`;
}

export async function startConversation(raw: unknown) {
  // 0) 入力検証
  const parsed = StartConversationInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, reason: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const { threadId, participants, topic, hints, idempotencyKey } = parsed.data;

  const sb = sbServer();
  const user = await getUserOrThrow();
  const now = new Date().toISOString();

  // 1) thread 取得（なければ必ず仮構築） ※ undefined を渡さない
  const { data: tRow } = await sb
    .from('topic_threads')
    .select('*')
    .eq('id', threadId)
    .eq('owner_id', user.id)
    .maybeSingle();

  // participants は [string, string] のタプルに揃える関数
  const tupleParticipants = (arr: unknown): [string, string] => {
    if (Array.isArray(arr) && arr.length === 2) {
      return [String(arr[0]), String(arr[1])];
    }
    // fallback: parsed.data.participants を使用
    return [String(participants[0]), String(participants[1])];
  };

  const thread: TopicThread = tRow
    ? {
      id: String(tRow.id),
      topic: tRow.topic ?? undefined,
      participants: tupleParticipants(tRow.participants),
      status: (tRow.status ?? 'ongoing') as TopicThread['status'],
      lastEventId: tRow.last_event_id ?? undefined,
      updated_at: String(tRow.updated_at ?? now),
      deleted: Boolean(tRow.deleted ?? false),
    }
    : {
      id: threadId,
      topic: topic,
      participants: tupleParticipants(participants),
      status: 'ongoing',
      lastEventId: undefined,
      updated_at: now,
      deleted: false,
    };


  // 2) Belief（必要なら取得、ここでは空で進める）
  const beliefs: Record<string, any> = {};

  // 3) GPT 生成 → 4) 評価
  const gptOut = await callGptForConversation({
    thread,
    beliefs,
    topicHint: topic,
    lastSummary: undefined,
  });
  const evalResult = evaluateConversation({ output: gptOut, beliefs });

  // 5) 行組み立て
  const systemLine = makeSystemLine(gptOut, evalResult);
  const eventId = randomUUID();
  const first = gptOut.lines?.[0];
  const snippet = first ? `${first.speaker.slice(0, 4)}: ${first.text.slice(0, 28)}…` : undefined;

  const eventRow = {
    id: eventId,
    kind: 'conversation',
    payload: { ...gptOut, deltas: evalResult.deltas, systemLine },
    updated_at: now,
    deleted: false,
    owner_id: user.id,
    idempotency_key: idempotencyKey ?? null,
  };

  const notifRow = {
    id: randomUUID(),
    type: 'conversation' as const,
    status: 'unread' as const,
    linked_event_id: eventId,
    occurred_at: now,
    priority: 0,
    updated_at: now,
    deleted: false,
    owner_id: user.id,
    // UI補助
    thread_id: gptOut.threadId,
    participants: gptOut.participants as [string, string],
    snippet,
  };

  // 6) 保存
  {
    const { error: e1 } = await withRetry(async () => {
      const res = await sb.from('events').upsert(eventRow).select().single();
      if (res.error) throw res.error;
      return res;
    });

    const { error: e2 } = await withRetry(async () => {
      const res = await sb.from('notifications').upsert(notifRow).select().single();
      if (res.error) throw res.error;
      return res;
    });

    const { error: e3 } = await withRetry(async () => {
      const res = await sb
        .from('topic_threads')
        .upsert({
          id: threadId,
          topic: topic ?? null,
          participants,
          status: 'ongoing',
          last_event_id: eventId,
          updated_at: now,
          deleted: false,
          owner_id: user.id,
        })
        .select()
        .maybeSingle();
      if (res.error) throw res.error;
      return res;
    });
  }

    // 7) Belief 反映（B-7）
    if (Array.isArray((evalResult as any)?.newBeliefs) && (evalResult as any).newBeliefs.length > 0) {
      try {
        const { upsertBeliefs } = await import('./upsert-beliefs');
        const res = await upsertBeliefs(
          (evalResult as any).newBeliefs.map((b: any) => ({
            residentId: b.residentId,
            worldFacts: b.worldFacts,
            personKnowledge: b.personKnowledge,
          }))
        );
        if (!res.ok) console.warn('upsertBeliefs failed', res);
      } catch (e) {
        console.warn('upsertBeliefs thrown', e);
      }
    }

    // 8) スレッドの最終イベント更新
    await sb.from('topic_threads').upsert({
      id: threadId,
      topic: topic ?? null,
      participants,
      status: 'ongoing',
      last_event_id: eventId,
      updated_at: now,
      deleted: false,
      owner_id: user.id,
    });

    return { ok: true as const, eventId };
  }
