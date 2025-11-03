import { openDB, IDBPDatabase } from "idb";
import type { TConversation, TMessage, TNotification } from "../schemas/conversation";

type DBSchema = {
  conversations: TConversation;
  messages: TMessage;
  notifications: TNotification;
};

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB("reladen", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("conversations")) {
          const s = db.createObjectStore("conversations", { keyPath: "id" });
          s.createIndex("created_at", "created_at");
        }
        if (!db.objectStoreNames.contains("messages")) {
          const s = db.createObjectStore("messages", { keyPath: "id" });
          s.createIndex("conv", "conversation_id");
          s.createIndex("created_at", "created_at");
        }
        if (!db.objectStoreNames.contains("notifications")) {
          const s = db.createObjectStore("notifications", { keyPath: "id" });
          s.createIndex("created_at", "created_at");
          s.createIndex("is_read", "is_read");
        }
      },
    });
  }
  return dbPromise!;
}

export async function upsertConversations(rows: TConversation[]) {
  const db = await getDB();
  const tx = db.transaction("conversations", "readwrite");
  for (const r of rows) await tx.store.put(r);
  await tx.done;
}

export async function upsertMessages(rows: TMessage[]) {
  const db = await getDB();
  const tx = db.transaction("messages", "readwrite");
  for (const r of rows) await tx.store.put(r);
  await tx.done;
}

export async function upsertNotifications(rows: TNotification[]) {
  const db = await getDB();
  const tx = db.transaction("notifications", "readwrite");
  for (const r of rows) await tx.store.put(r);
  await tx.done;
}
