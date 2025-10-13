'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { EventLog, Feeling, Relation, Resident } from '@reladen/types';
import { newId } from '@/lib/newId';

export type LocalTableName = 'residents' | 'relations' | 'feelings' | 'events';

type Entity = Resident | Relation | Feeling | EventLog;

interface ReladenSchema extends DBSchema {
  residents: {
    key: string;
    value: Resident;
  };
  relations: {
    key: string;
    value: Relation;
  };
  feelings: {
    key: string;
    value: Feeling;
  };
  events: {
    key: string;
    value: EventLog;
  };
}

type Snapshot = Record<LocalTableName, Record<string, Entity>>;

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

function createEmptySnapshot(): Snapshot {
  return {
    residents: {},
    relations: {},
    feelings: {},
    events: {},
  };
}

let dbPromise: Promise<IDBPDatabase<ReladenSchema>> | null = null;
let tauriState: { snapshot: Snapshot; persist: () => Promise<void> } | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ReladenSchema>('reladen', 1, {
      upgrade(database) {
        database.createObjectStore('residents');
        database.createObjectStore('relations');
        database.createObjectStore('feelings');
        database.createObjectStore('events');
      },
    });
  }
  return dbPromise;
}

async function getTauriState() {
  if (!isTauri) return null;
  if (tauriState) return tauriState;
  const { readTextFile, writeTextFile, createDir, BaseDirectory } = await import('@tauri-apps/api/fs');

  try {
    await createDir('', { dir: BaseDirectory.AppData, recursive: true });
  } catch (error) {
    console.warn('Tauriディレクトリ作成に失敗しました', error);
  }

  let snapshot: Snapshot = createEmptySnapshot();
  try {
    const raw = await readTextFile('app.db', { dir: BaseDirectory.AppData });
    snapshot = { ...createEmptySnapshot(), ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    await writeTextFile({ path: 'app.db', contents: JSON.stringify(snapshot) }, { dir: BaseDirectory.AppData });
  }

  async function persist() {
    await writeTextFile({ path: 'app.db', contents: JSON.stringify(snapshot) }, { dir: BaseDirectory.AppData });
  }

  tauriState = { snapshot, persist };
  return tauriState;
}

export async function putLocal<T extends Entity>(table: LocalTableName, entity: Partial<T>) {
  const id = (entity as Resident).id ?? newId();
  const now = new Date().toISOString();
  const value = {
    ...entity,
    id,
    updated_at: entity.updated_at ?? now,
    deleted: entity.deleted ?? false,
  } as T;
  if (isTauri) {
    const state = await getTauriState();
    if (state) {
      state.snapshot[table][id] = value;
      await state.persist();
      return value;
    }
  }
  const db = await getDb();
  await db.put(table, value, id);
  return value;
}

export async function listLocal<T extends Entity>(table: LocalTableName): Promise<T[]> {
  if (isTauri) {
    const state = await getTauriState();
    if (state) {
      return Object.values(state.snapshot[table]) as T[];
    }
  }
  const db = await getDb();
  const values = await db.getAll(table);
  return values as T[];
}

export async function getLocal<T extends Entity>(table: LocalTableName, id: string) {
  if (isTauri) {
    const state = await getTauriState();
    if (state) {
      return state.snapshot[table][id] as T | undefined;
    }
  }
  const db = await getDb();
  return (await db.get(table, id)) as T | undefined;
}

export async function markDeleted(table: LocalTableName, id: string) {
  const record = await getLocal(table, id);
  if (!record) return;
  await putLocal(table, { ...record, deleted: true, updated_at: new Date().toISOString() });
}

export async function bulkUpsert(table: LocalTableName, entities: Entity[]) {
  if (isTauri) {
    const state = await getTauriState();
    if (state) {
      for (const entity of entities) {
        const id = (entity as any).id;
        state.snapshot[table][id] = entity as any;
      }
      await state.persist();
      return;
    }
  }
  const db = await getDb();
  const tx = db.transaction(table, 'readwrite');
  await Promise.all(entities.map((entity) => tx.store.put(entity as any, (entity as any).id)));
  await tx.done;
}

export async function since(table: LocalTableName, isoDate: string | null) {
  const items = await listLocal(table);
  if (!isoDate) return items;
  const sinceDate = new Date(isoDate).getTime();
  return items.filter((item) => new Date(item.updated_at).getTime() > sinceDate);
}
