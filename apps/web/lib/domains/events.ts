// apps/web/lib/domain/events.ts
import type { EventLog } from '@/../../packages/shared/types';
import { nowISOJST } from '../time';

export async function appendEventLog(_log: Omit<EventLog, 'id' | 'at'>): Promise<EventLog> {
  // TODO: id 生成して保存。at は nowISOJST() をデフォルト採用。
  return { id: 'TBD', at: nowISOJST(), ...(_log as any) } as EventLog;
}

export async function listEventLogs(): Promise<EventLog[]> {
  // TODO: 日付/キャラ/種別などでクエリできるように
  return [];
}
