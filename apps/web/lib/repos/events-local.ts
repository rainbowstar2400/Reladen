'use client';
import { getLocal, listLocal } from '@/lib/db-local';
import type { EventLogStrict } from '@repo/shared/types/conversation';

export async function getEventByIdLocal(id: string) {
  return (await getLocal('events', id)) as EventLogStrict | undefined;
}

export async function listEventsByThreadLocal(threadId: string) {
  const all = (await listLocal('events')) as EventLogStrict[];
  return all
    .filter(e => e.kind === 'conversation' && (e as any).payload?.threadId === threadId)
    .sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? ''));
}
