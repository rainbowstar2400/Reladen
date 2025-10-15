import { NextRequest, NextResponse } from 'next/server';
import { syncPayloadSchema } from '@/types';
import { SyncStore, type SyncEntity } from '../store';

const store = (() => {
  const globalScope = globalThis as typeof globalThis & {
    __reladenSyncStore?: SyncStore;
  };

  if (!globalScope.__reladenSyncStore) {
    globalScope.__reladenSyncStore = new SyncStore();
  }

  return globalScope.__reladenSyncStore;
})();

function compareTimestamps(local: string, remote?: string) {
  if (!remote) return true;
  const localTime = new Date(local).getTime();
  const remoteTime = new Date(remote).getTime();
  if (localTime === remoteTime) {
    return false; // クラウド優先
  }
  return localTime > remoteTime;
}

export async function POST(request: NextRequest, { params }: { params: { table: string } }) {
  const table = params.table;
  if (!store.has(table)) {
    return NextResponse.json({ error: 'table not found' }, { status: 404 });
  }

  const json = await request.json();
  const parsed = syncPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data;
  const tableStore = store.get(table);

  for (const change of payload.changes) {
    const { data, updated_at } = change;
    if (typeof data.id !== 'string') {
      continue;
    }
    const current = tableStore.get(data.id) as SyncEntity | undefined;
    if (!current || compareTimestamps(updated_at, current.updated_at)) {
      const next: SyncEntity = {
        ...(current ?? {}),
        ...data,
        id: data.id,
        updated_at,
      };
      tableStore.set(data.id, next);
    }
  }

  const since = payload.since ? new Date(payload.since).getTime() : 0;
  const cloudChanges = Array.from(tableStore.values())
    .filter((item) => new Date(item.updated_at).getTime() > since)
    .map((item) => ({ data: item, updated_at: item.updated_at, deleted: item.deleted ?? false }));

  return NextResponse.json({
    table,
    changes: cloudChanges,
    since: payload.since,
  });
}
