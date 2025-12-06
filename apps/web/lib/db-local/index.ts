'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { EventLog, Feeling, Relation, Resident, Nickname, Preset, WorldStateRecord } from '@/types';
import {
  BeliefRecord,
  NotificationRecord,
  TopicThread,
  EventLogStrict,
} from '@repo/shared/types/conversation';
import { BaseEntity } from '@repo/shared/types'; // バレル経由

export type LocalTableName =
  | 'residents'
  | 'relations'
  | 'feelings'
  | 'events'
  | 'topic_threads'
  | 'beliefs'
  | 'notifications'
  | 'consult_answers'
  | 'nicknames'
  | 'presets'
  | 'world_states';

type Entity =
  & BaseEntity
  & (
    | Resident
    | Relation
    | Feeling
    | EventLog
    | EventLogStrict
    | TopicThread
    | BeliefRecord
    | NotificationRecord
    | Nickname
    | Preset
    | WorldStateRecord
  );

type PartialEntity<T extends Entity> = Partial<T> & Partial<BaseEntity>;

interface ReladenSchema extends DBSchema {
  residents: { key: string; value: Resident; };
  relations: { key: string; value: Relation; };
  feelings: { key: string; value: Feeling; };
  events: { key: string; value: EventLog | EventLogStrict; };
  topic_threads: { key: string; value: TopicThread; };
  beliefs: { key: string; value: BeliefRecord; };
  notifications: { key: string; value: NotificationRecord; };
  nicknames: { key: string; value: Nickname; };
  consult_answers: {
    key: string; value: {
      id: string;
      selectedChoiceId: string | null;
      decidedAt: string;   // ISO
      updated_at: string;  // ISO
      deleted: boolean;
    };
  };
  presets: { key: string; value: Preset; };
  world_states: { key: string; value: WorldStateRecord; };
}

type Snapshot = Record<LocalTableName, Record<string, Entity>>;

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

/** ベースのデフォルトを与えるユーティリティ（拡張しやすく分離） */
function withEntityDefaults<T extends Entity>(input: PartialEntity<T>): T {
  const now = new Date().toISOString();
  return {
    ...input,
    id: input.id ?? (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)), // newId() に置換可
    updated_at: input.updated_at ?? now,
    deleted: input.deleted ?? false,
  } as T;
}


function createEmptySnapshot(): Snapshot {
  return {
    residents: {},
    relations: {},
    feelings: {},
    events: {},
    topic_threads: {},
    beliefs: {},
  notifications: {},
  consult_answers: {},
  nicknames: {},
  presets: {},
  world_states: {},
};
}

let dbPromise: Promise<IDBPDatabase<ReladenSchema>> | null = null;
let tauriState: { snapshot: Snapshot; persist: () => Promise<void> } | null = null;

const DB_NAME = 'reladen-db';
const DB_VERSION = 5;

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ReladenSchema>('reladen', DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          database.createObjectStore('residents');
          database.createObjectStore('relations');
          database.createObjectStore('feelings');
          database.createObjectStore('events');
        }
        if (oldVersion < 2) {
          database.createObjectStore('topic_threads');
          database.createObjectStore('beliefs');
          database.createObjectStore('notifications');
        }
        if (oldVersion < 3) {
          database.createObjectStore('consult_answers');
        }
        if (oldVersion < 4) {
          database.createObjectStore('nicknames');
        }
        if (oldVersion < 5) {
          database.createObjectStore('world_states');
        }
        if (oldVersion < 2) {
          if (!database.objectStoreNames.contains('presets')) {
            database.createObjectStore('presets');
          }
        }
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

// ▼ ここが今回の本丸：BaseEntity 前提なので .updated_at / .deleted に安全に触れる
export async function putLocal<T extends Entity>(table: LocalTableName, entity: PartialEntity<T>) {
  const value = withEntityDefaults<T>(entity);

  if (isTauri) {
    const state = await getTauriState();
    if (state) {
      state.snapshot[table][value.id] = value;
      await state.persist();
      return value;
    }
  }
  const db = await getDb();
  await db.put(table, value, value.id);
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

export async function getLocal<T extends Entity>(
  table: LocalTableName,
  id: string
): Promise<T | undefined> {
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

// 追加：全ストア初期化（ローカルデータ消去）
export async function clearLocalAll() {
  // Tauri: スナップショットを空にして保存
  if (isTauri) {
    const state = await getTauriState();
    if (state) {
      state.snapshot = createEmptySnapshot();
      await state.persist();
      return;
    }
  }
  // ブラウザ IndexedDB: 既存ストアをクリア
  const db = await getDb();
  const stores: LocalTableName[] = [
    'residents', 'relations', 'feelings', 'events',
    'topic_threads', 'beliefs', 'notifications', 'consult_answers', 'nicknames', 'presets', 'world_states'
  ];
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((name) => tx.objectStore(name).clear()));
  await tx.done;
}

export async function removeLocal(table: LocalTableName, id: string) {
  if (isTauri) {
    const state = await getTauriState();
    if (state) {
      delete state.snapshot[table][id];
      await state.persist();
      return;
    }
  }

  const db = await getDb();
  const tx = db.transaction(table, 'readwrite');
  await tx.objectStore(table).delete(id);
  await tx.done;
}
