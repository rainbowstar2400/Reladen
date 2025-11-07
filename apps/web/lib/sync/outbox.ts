// apps/web/lib/sync/outbox.ts
export type OutboxTable = 'residents'|'relations'|'feelings'|'events'|'consult_answers';

export type OutboxEntry = {
  id: string;                       // レコードID
  table: OutboxTable;
  data: Record<string, any>;        // upsert対象（deleted含む）
  updated_at: string;               // ISO (LWW)
  deleted?: boolean;
  status: 'pending'|'sent'|'failed';
  lastError?: string;
  enqueuedAt: string;               // 監査用
  attempts: number;                 // 送信試行回数
};

// 独立DB（既存 idb と干渉しない）
const DB_NAME = 'reladen-sync';
const STORE = 'sync_outbox';
const DB_VER = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'key' });
        os.createIndex('by_table', 'table', { unique: false });
        os.createIndex('by_status', 'status', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function store(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}
export function makeOutboxKey(table: OutboxTable, id: string) {
  return `${table}:${id}`;
}
function stripKey<T extends { key?: string }>(obj: T) {
  const { key, ...rest } = obj as any;
  return rest;
}

/** upsert: id+table で一意。updated_at が新しければ置き換え */
export async function enqueueOutbox(entry: Omit<OutboxEntry,'status'|'enqueuedAt'|'attempts'>) {
  const db = await openDB();
  const s = store(db, 'readwrite');
  const key = makeOutboxKey(entry.table, entry.id);

  const existing: any = await new Promise((resolve) => {
    const r = s.get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => resolve(null);
  });

  const base: OutboxEntry & { key: string } = {
    key,
    ...entry,
    status: 'pending',
    enqueuedAt: new Date().toISOString(),
    attempts: existing?.attempts ?? 0,
  };

  const shouldWrite =
    !existing || new Date(entry.updated_at).getTime() >= new Date(existing.updated_at).getTime();

  if (shouldWrite) {
    await new Promise<void>((resolve, reject) => {
      const p = s.put(base);
      p.onsuccess = () => resolve();
      p.onerror = () => reject(p.error);
    });
  }
}

/** 指定テーブルの pending を全件（enqueuedAt 昇順） */
export async function listPendingByTable(table: OutboxTable) {
  const db = await openDB();
  const s = store(db, 'readonly');
  const idx = s.index('by_status');
  const res: OutboxEntry[] = [];
  await new Promise<void>((resolve) => {
    const c = idx.openCursor(IDBKeyRange.only('pending'));
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur) return resolve();
      const v = cur.value as OutboxEntry & { key: string };
      if (v.table === table) res.push(stripKey(v));
      cur.continue();
    };
    c.onerror = () => resolve();
  });
  return res.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
}

export async function markSent(keys: string[]) {
  if (keys.length === 0) return;
  const db = await openDB();
  const s = store(db, 'readwrite');
  await Promise.all(keys.map(async (key) => {
    await new Promise<void>((resolve) => {
      const d = s.delete(key);
      d.onsuccess = () => resolve();
      d.onerror = () => resolve();
    });
  }));
}

export async function markFailed(keys: string[], message: string) {
  if (keys.length === 0) return;
  const db = await openDB();
  const s = store(db, 'readwrite');
  await Promise.all(keys.map(async (key) => {
    const cur: any = await new Promise((resolve) => {
      const g = s.get(key);
      g.onsuccess = () => resolve(g.result ?? null);
      g.onerror = () => resolve(null);
    });
    if (!cur) return;
    cur.status = 'failed';
    cur.attempts = (cur.attempts ?? 0) + 1;
    cur.lastError = (message ?? '').slice(0, 500);
    await new Promise<void>((resolve) => {
      const p = s.put(cur);
      p.onsuccess = () => resolve();
      p.onerror = () => resolve();
    });
  }));
}
