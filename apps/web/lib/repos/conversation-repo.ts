// apps/web/lib/repos/conversation-repo.ts
'use client';

/**
 * 会話イベント（events）と通知（notifications）の生成・取得。
 * - IndexedDB (db-local) を前提（後日 Supabase 置換しやすい形）
 * - 型衝突を避けるため、会話ペイロードを自前の Strict 型に固定
 */

import { putLocal, listLocal, getLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import { remoteUpsertEvent, remoteUpsertNotification } from '@/lib/sync/remote-events';

import type {
  EventLogStrict,
  NotificationRecord,
} from '@repo/shared/types/conversation';

/** Union 回避のため、会話イベント用の厳密な型を自前定義 */
export type ConversationPayloadStrict = {
  threadId: string;
  participants: [string, string];
  lines: { speaker: string; text: string }[];
  meta: {
    tags: string[];
    newKnowledge: { target: string; key: string }[];
    signals?: ('continue' | 'close' | 'park')[];
    qualityHints?: { [k: string]: unknown };
  };
  deltas: {
    aToB: { favor: number; impression: string };
    bToA: { favor: number; impression: string };
  };
  systemLine: string;
  topic?: string;
};

function isConversationPayload(p: unknown): p is ConversationPayloadStrict {
  const g = p as ConversationPayloadStrict | undefined;
  return !!g
    && typeof g.threadId === 'string'
    && Array.isArray(g.participants)
    && g.participants.length === 2
    && Array.isArray(g.lines);
}

/**
 * 会話イベントを JST の「日付」単位でグルーピングして返す。
 * @param opts from/to: ISO 文字列（JST 日付キーの後段フィルタにも使える）。limitDays: 直近 N 日に絞る簡易オプション。
 */
export async function listConversationEventsByDate(opts?: {
  from?: string;   // ISO
  to?: string;     // ISO
  limitDays?: number;
}): Promise<ConversationDayGroup[]> {
  const all = (await listLocal('events')) as Array<EventLogStrict>;

  // 1) 会話イベントのみ
  let convs = all
    .filter((e) => e?.kind === 'conversation' && isConversationPayload(e?.payload));

  // 2) 期間フィルタ（updated_at ベース / ISO）
  const fromTs = opts?.from ? Date.parse(opts.from) : undefined;
  const toTs   = opts?.to   ? Date.parse(opts.to)   : undefined;

  convs = convs.filter((e) => {
    const iso = (e as any).updated_at as string | undefined;
    if (!iso) return false;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return false;
    if (fromTs && t < fromTs) return false;
    if (toTs && t > toTs) return false;
    return true;
  });

  // 3) 直近N日で絞る（簡易）
  if (opts?.limitDays && opts.limitDays > 0) {
    const now = Date.now();
    const span = opts.limitDays * 86400000;
    convs = convs.filter((e) => {
      const iso = (e as any).updated_at as string | undefined;
      if (!iso) return false;
      const t = Date.parse(iso);
      return Number.isFinite(t) && (now - t) <= span;
    });
  }

  // 4) 変換 & グルーピング
  const byDate = new Map<string, ConversationDayGroup>();

  for (const ev of convs) {
    const iso = (ev as any).updated_at as string; // persist 側で必ず入る想定
    const p = ev.payload as ConversationPayloadStrict;

    const { dateKey, dateLabel, weekday, timeLabel } = toJstDateKey(iso);

    const item: ConversationListItem = {
      id: (ev as any).id,
      threadId: p.threadId,
      participants: p.participants,
      timeISO: iso,
      timeLabel,
      systemLine: p.systemLine,
      topic: p.topic,
      deltas: p.deltas, // impression は string に型修正済み
    };

    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, { dateKey, dateLabel, weekday, items: [item] });
    } else {
      byDate.get(dateKey)!.items.push(item);
    }
  }

  // 5) 並び替え：日付降順 → 同日の items は時刻降順
  const groups = Array.from(byDate.values())
    .map((g) => ({
      ...g,
      items: g.items.sort((a, b) => b.timeISO.localeCompare(a.timeISO)),
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  return groups;
}

/** Notification を db-local へ入れる際、BaseEntity の deleted を付与 */
type LocalNotificationEntity = NotificationRecord & { deleted: boolean };

/** EventLogStrict を生成（payload は Strict 型） */
function makeEventRecord(payload: ConversationPayloadStrict): EventLogStrict {
  const now = new Date().toISOString();
  // payload は会話専用。EventLogStrict は payload: union なので as で固定。
  return {
    id: newId(),
    kind: 'conversation',
    updated_at: now,
    deleted: false,
    payload: payload as unknown as EventLogStrict['payload'],
  };
}

/** 会話イベント → 通知レコード生成（snippet は1行目ベース） */
function makeNotificationForEvent(ev: EventLogStrict): LocalNotificationEntity {
  const now = new Date().toISOString();
  const p = isConversationPayload(ev.payload) ? ev.payload : undefined;

  const snippet =
    (p?.lines?.[0]?.text?.slice(0, 60) ?? '会話が発生しました。') +
    (p?.lines && p.lines.length > 1 ? ' …' : '');

  const base: NotificationRecord = {
    id: newId(),
    type: 'conversation',
    linkedEventId: ev.id,
    threadId: p?.threadId,
    participants: p?.participants,
    snippet,
    occurredAt: now,
    status: 'unread',
    priority: 0,
    updated_at: now,
  };

  // db-local の Entity 制約（deleted 必須）を満たす
  return { ...base, deleted: false };
}

/** 会話イベントを作成し、通知も登録。戻り値は ev.id */
export async function createConversationEvent(payload: ConversationPayloadStrict): Promise<string> {
  const ev = makeEventRecord(payload);

  // 1) events へ保存（型を EventLogStrict に固定）
  await putLocal<EventLogStrict>('events', ev);

  // 2) notifications へ保存（deleted 付きローカル型で満たす）
  const notif = makeNotificationForEvent(ev);
  await putLocal<LocalNotificationEntity>('notifications', notif);

  await putLocal<EventLogStrict>('events', ev);
  await putLocal('notifications', notif as any);
  await syncEventAndNotificationToRemote(ev, notif);

  return ev.id;
}

/** ID で会話イベント1件取得（会話以外は undefined ） */
export async function getConversationById(id: string): Promise<EventLogStrict | undefined> {
  const rec = (await getLocal('events', id)) as EventLogStrict | undefined;
  if (!rec) return undefined;
  return rec.kind === 'conversation' ? rec : undefined;
}

/** 会話イベント一覧（更新降順） */
export async function listConversations(): Promise<EventLogStrict[]> {
  const all = (await listLocal('events')) as Array<EventLogStrict>;
  return all
    .filter((e) => e?.kind === 'conversation')
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
}

/** スレッドIDで絞り込み（更新降順） */
export async function listThreadConversations(threadId: string): Promise<EventLogStrict[]> {
  const all = await listConversations();
  return all.filter((e) => isConversationPayload(e.payload) && e.payload.threadId === threadId);
}

/** 通知の既読化（必要に応じて使用） */
export async function markNotificationRead(id: string): Promise<void> {
  // NotificationRecord を直接 get してもよいが、db-local の戻りは Union なので as で取得
  const rec = (await getLocal('notifications', id)) as LocalNotificationEntity | undefined;
  if (!rec || rec.status === 'read') return;
  await putLocal<LocalNotificationEntity>('notifications', {
    ...rec,
    status: 'read',
    updated_at: new Date().toISOString(),
  });
}

/** 最低限のバリデーション（呼び出し前に利用可能） */
export function validateConversationPayload(payload: ConversationPayloadStrict): { ok: true } | { ok: false; reason: string } {
  if (!payload?.threadId) return { ok: false, reason: 'threadId がありません。' };
  if (!Array.isArray(payload.participants) || payload.participants.length !== 2)
    return { ok: false, reason: 'participants は [string, string] である必要があります。' };
  if (!Array.isArray(payload.lines) || payload.lines.length === 0)
    return { ok: false, reason: 'lines が空です。最低1行必要です。' };
  return { ok: true };
}

function supabaseReady() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function syncEventAndNotificationToRemote(ev: EventLogStrict, notif: { id: string } & Record<string, any>) {
  if (!supabaseReady()) return; // devローカルのみなら同期スキップ
  try {
    await remoteUpsertEvent(ev);
    await remoteUpsertNotification(notif as any);
  } catch (e) {
    // 失敗してもUIはローカルで動くため、ログのみ
    console.warn('remote sync failed', e);
  }
}

export async function loadConversationEventById(eventId: string): Promise<any | null> {
  const arr = (await listLocal('events')) as any[];
  return arr.find((e) => e.id === eventId) ?? null;
}

export type ConversationListItem = {
  id: string;
  threadId: string;
  participants: [string, string];
  timeISO: string;        // 例: "2025-11-05T10:23:00.000Z"（元データの updated_at）
  timeLabel: string;      // 例: "10:23"
  systemLine?: string;    // "SYSTEM: ..."（存在すれば）
  topic?: string;         // ある場合のみ
  deltas: {
    aToB: { favor: number; impression: string };
    bToA: { favor: number; impression: string };
  };
};

export type ConversationDayGroup = {
  dateKey: string;        // "2025-11-05"（JST基準）
  dateLabel: string;      // "2025/11/05"
  weekday: string;        // "水"
  items: ConversationListItem[];
};

function toJstDateKey(iso: string): { dateKey: string; dateLabel: string; weekday: string; timeLabel: string } {
  const d = new Date(iso);

  const dateFmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const weekdayFmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', weekday: 'short' });
  const timeFmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

  const [y, m, day] = dateFmt.format(d).split('/');   // "2025/11/05"
  const dateLabel = `${y}/${m}/${day}`;
  const dateKey = `${y}-${m}-${day}`;                 // "2025-11-05"
  const weekday = weekdayFmt.format(d);               // "水"
  const timeLabel = timeFmt.format(d);                // "10:23"

  return { dateKey, dateLabel, weekday, timeLabel };
}

