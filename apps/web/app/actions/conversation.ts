// apps/web/app/actions/conversation.ts
'use server';

import 'server-only';
import { StartConversationInput, type TStartConversationInput } from '@/lib/schemas/server/conversation';
import { sb } from '@/lib/supabase/client'; // SSR対応のserver clientが必要なら分けてもOK
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

type ConversationPayloadStrict = {
  threadId: string;
  participants: [string, string];
  lines: { speaker: string; text: string }[];
  meta: {
    tags: string[];
    newKnowledge: { target: string; key: string }[];
    signals?: ('continue'|'close'|'park')[];
    qualityHints?: Record<string, unknown>;
  };
  deltas: {
    aToB: { favor: number; impression: number };
    bToA: { favor: number; impression: number };
  };
  systemLine: string;
  topic?: string;
};

type EventLogStrict = {
  id: string;
  kind: 'conversation';
  payload: ConversationPayloadStrict; // 他種とUnionだがここは固定でOK
  updated_at: string;
  deleted: boolean;
};

type NotificationRecord = {
  id: string;
  type: 'conversation' | 'consult' | 'system';
  status: 'unread' | 'read' | 'archived';
  linkedEventId: string;
  occurredAt: string;
  priority: number;
  updated_at: string;
  // 既存UI向け補助
  threadId?: string;
  participants?: [string,string];
  snippet?: string;
  // db-local BaseEntity互換
  deleted: boolean;
};

/** OpenAI呼び出し（未設定ならモックにフォールバック） */
async function generateConversation(input: TStartConversationInput): Promise<ConversationPayloadStrict> {
  const now = new Date().toISOString();
  const [a, b] = input.participants;
  const topic = input.topic ?? '日常の雑談';
  const maxLines = input.hints?.maxLines ?? 6;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // === フォールバック: 決定的ダミー ===
    const lines = [
      { speaker: a, text: `ねえ、${topic} の件どう思う？` },
      { speaker: b, text: `うーん、悪くないよ。今日の気分にも合ってるし。` },
      { speaker: a, text: `それなら少し試してみようか。` },
      { speaker: b, text: `OK。終わったら感想教えてね。` },
    ].slice(0, Math.max(2, maxLines));
    return {
      threadId: input.threadId,
      participants: [a, b],
      lines,
      meta: { tags: ['fallback','demo'], newKnowledge: [] },
      deltas: { aToB: { favor: 1, impression: 0 }, bToA: { favor: 1, impression: 0 } },
      systemLine: `SYSTEM: ${a}→${b} 好感度 +1 / 印象 → | ${b}→${a} 好感度 +1 / 印象 →`,
      topic,
    };
  }

  // === 実運用: OpenAI 呼び出し（雛形）===
  // ここでは“疑似コード”。実際は OpenAI SDK / fetch を利用し、会話linesを生成してください。
  // - server-only 環境で呼ぶ（クライアントへキーを露出しない）
  // - プロンプトには participants / topic / hints を反映
  // - 出力は ConversationPayloadStrict に整形

  // 例:
  // const resp = await fetch('https://api.openai.com/v1/chat/completions', { ... });
  // const lines = parseToLines(await resp.json());

  const lines = [
    { speaker: a, text: `（AI出力想定）${topic} について話そう。` },
    { speaker: b, text: `（AI出力想定）いいね、最近気になってたんだ。` },
  ];

  return {
    threadId: input.threadId,
    participants: [a, b],
    lines,
    meta: { tags: ['ai','generated'], newKnowledge: [] },
    deltas: { aToB: { favor: 1, impression: 1 }, bToA: { favor: 0, impression: 1 } },
    systemLine: `SYSTEM: ${a}→${b} 好感度 +1 / 印象 ↑ | ${b}→${a} 好感度 +0 / 印象 ↑`,
    topic,
  };
}

/** Supabaseにアップサート（B-1のテーブル前提） */
async function upsertToSupabase(ev: EventLogStrict, notif: NotificationRecord) {
  // events
  {
    const { error } = await sb.from('events').upsert({
      id: ev.id,
      kind: ev.kind,
      payload: ev.payload,
      updated_at: ev.updated_at,
      deleted: ev.deleted,
    }).select().single();
    if (error) throw error;
  }
  // notifications
  {
    const { error } = await sb.from('notifications').upsert({
      id: notif.id,
      type: notif.type,
      status: notif.status,
      linked_event_id: notif.linkedEventId,
      occurred_at: notif.occurredAt,
      priority: notif.priority,
      updated_at: notif.updated_at,
      deleted: notif.deleted,
      thread_id: notif.threadId ?? null,
      participants: notif.participants ?? null,
      snippet: notif.snippet ?? null,
    }).select().single();
    if (error) throw error;
  }
}

/** 公開サーバアクション：会話を生成して保存。戻り値は eventId */
export async function startConversation(raw: unknown): Promise<{ ok: true; eventId: string } | { ok: false; reason: string }> {
  // 入力検証
  const parsed = StartConversationInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map(i => i.message).join(', ') };
  }
  const input = parsed.data;

  // 生成
  const payload = await generateConversation(input);

  // レコード組立
  const now = new Date().toISOString();
  const eventId = randomUUID();
  const ev: EventLogStrict = {
    id: eventId,
    kind: 'conversation',
    payload,
    updated_at: now,
    deleted: false,
  };

  const snippet =
    (payload.lines?.[0]?.text?.slice(0, 60) ?? '会話が発生しました。') +
    (payload.lines && payload.lines.length > 1 ? ' …' : '');

  const notif: NotificationRecord = {
    id: randomUUID(),
    type: 'conversation',
    status: 'unread',
    linkedEventId: ev.id,
    occurredAt: now,
    priority: 0,
    updated_at: now,
    deleted: false,
    threadId: payload.threadId,
    participants: payload.participants,
    snippet,
  };

  // Supabase 保存（B-1のスキーマ／RLS前提）
  try {
    await upsertToSupabase(ev, notif);
  } catch (e: any) {
    return { ok: false, reason: `remote upsert failed: ${e?.message ?? String(e)}` };
  }

  // Realtime購読済みのクライアントへは自動pushされる
  // SSRの再検証が必要ならここで revalidatePath する（ダッシュボードなど）
  try {
    revalidatePath('/'); // 任意
  } catch {}

  return { ok: true, eventId };
}
