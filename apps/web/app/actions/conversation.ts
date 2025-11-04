// apps/web/app/actions/conversation.ts
'use server';

import 'server-only';
import { randomUUID } from 'crypto';
import { StartConversationInput } from '@/lib/schemas/server/conversation';
import { callGptForConversation } from '@/lib/gpt/call-gpt-for-conversation';
import { evaluateConversation } from '@/lib/evaluation/evaluate-conversation';
import { sbServer } from '../../lib/supabase/server';
import type { TopicThread, BeliefRecord } from '@repo/shared/types/conversation';
import type { GptConversationOutput } from '@repo/shared/gpt/schemas/conversation-output';
import type { EvaluationResult } from '@/lib/evaluation/evaluate-conversation';

/**
 * SYSTEM 行を生成（persist-conversation.ts と同一ロジック）
 */
function makeSystemLine(out: GptConversationOutput, r: EvaluationResult): string {
  const [a, b] = out.participants;
  const fmt = (x: number) => (x > 0 ? `+${x}` : `${x}`);
  const impArrow = (x: number) => (x > 0 ? '↑' : x < 0 ? '↓' : '→');
  return `SYSTEM: ${a}→${b} 好感度 ${fmt(r.deltas.aToB.favor)} / 印象 ${impArrow(
    r.deltas.aToB.impression
  )} | ${b}→${a} 好感度 ${fmt(r.deltas.bToA.favor)} / 印象 ${impArrow(r.deltas.bToA.impression)}`;
}

/**
 * 新しい会話を生成 → 評価 → Supabase へ保存するサーバアクション
 */
export async function startConversation(raw: unknown) {
  // 入力検証
  const parsed = StartConversationInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, reason: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const { threadId, participants, topic, hints } = parsed.data;

  // サーバ用 Supabase クライアント
  const sb = sbServer();
  const now = new Date().toISOString();

  // 1) スレッド取得（無ければ仮作成）
  let thread: TopicThread | undefined;
  const { data: tRow } = await sb.from('topic_threads').select('*').eq('id', threadId).maybeSingle();
  if (tRow) {
    thread = {
      id: tRow.id,
      topic: tRow.topic ?? undefined,
      participants: tRow.participants as [string, string],
      status: tRow.status,
      lastEventId: tRow.last_event_id ?? undefined,
      updated_at: tRow.updated_at,
      deleted: tRow.deleted,
    };
  } else {
    thread = {
      id: threadId,
      topic: topic,
      participants: participants,
      status: 'ongoing',
      lastEventId: undefined,
      updated_at: now,
      deleted: false,
    };
  }

  // 2) 信念(Belief)取得（存在しなければ空オブジェクト）
  const { data: beliefRows } = await sb
    .from('beliefs')
    .select('*')
    .in('resident_id', participants)
    .maybeSingle();
  const beliefs: Record<string, BeliefRecord> = {};
  if (beliefRows) {
    // beliefRows は配列か単一か不定なのでどちらも処理
    const rows = Array.isArray(beliefRows) ? beliefRows : [beliefRows];
    for (const row of rows) {
      beliefs[row.resident_id] = {
        id: row.id,
        residentId: row.resident_id,
        worldFacts: row.world_facts,
        personKnowledge: row.person_knowledge,
        updated_at: row.updated_at,
        deleted: row.deleted,
      };
    }
  }

  // 3) GPT 会話生成
  const gptOut = await callGptForConversation({
    thread,
    beliefs,
    topicHint: topic,
    lastSummary: undefined,
  });

  // 4) 評価（好感度/印象変化と新規 Belief）
  const evalResult = evaluateConversation({
    output: gptOut,
    beliefs,
  });

  // 5) systemLine・snippets 組み立て
  const systemLine = makeSystemLine(gptOut, evalResult);
  const first = gptOut.lines[0];
  const snippet = first ? `${first.speaker.slice(0, 4)}: ${first.text.slice(0, 28)}…` : undefined;

  // 6) events / notifications データ作成
  const eventId = randomUUID();
  const eventRow = {
    id: eventId,
    kind: 'conversation',
    payload: {
      ...gptOut,
      deltas: evalResult.deltas,
      systemLine,
    },
    updated_at: now,
    deleted: false,
  };
  const notifId = randomUUID();
  const notifRow = {
    id: notifId,
    type: 'conversation',
    linked_event_id: eventId,
    thread_id: gptOut.threadId,
    participants: gptOut.participants,
    snippet,
    occurred_at: now,
    status: 'unread',
    priority: 0,
    updated_at: now,
    deleted: false,
  };

  // 7) Supabase へアップサート
  const { error: eventErr } = await sb.from('events').upsert(eventRow).select().single();
  if (eventErr) {
    return { ok: false as const, reason: `upsert events failed: ${eventErr.message}` };
  }
  const { error: notifErr } = await sb.from('notifications').upsert(notifRow).select().single();
  if (notifErr) {
    return { ok: false as const, reason: `upsert notifications failed: ${notifErr.message}` };
  }
  if (Array.isArray(evalResult.newBeliefs)) {
  const { upsertBeliefs } = await import('./upsert-beliefs');
  await upsertBeliefs(evalResult.newBeliefs);
}

// 7.5) 評価結果の newBeliefs を保存（B-7）
if (Array.isArray(evalResult?.newBeliefs) && evalResult.newBeliefs.length > 0) {
  try {
    const { upsertBeliefs } = await import('./upsert-beliefs');
    const res = await upsertBeliefs(
      evalResult.newBeliefs.map((b: any) => ({
        residentId: b.residentId,
        worldFacts: b.worldFacts,
        personKnowledge: b.personKnowledge,
      }))
    );
    if (!res.ok) {
      console.warn('upsertBeliefs failed', res);
    }
  } catch (e) {
    console.warn('upsertBeliefs thrown', e);
  }
}

  // 必要なら topic_threads.lastEventId や beliefs をここで更新する

  return { ok: true as const, eventId };
}
