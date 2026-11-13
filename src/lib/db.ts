import type { BookMeta, BookRecord } from "../types";
import { formatFromFileName } from "./format";
import { parseBookFileName } from "./filename";

const DB_NAME = "moyue-library";
const DB_VERSION = 3;
const STORE = "books";
const FONT_STORE = "fonts";
const BACKGROUND_STORE = "backgrounds";

export interface FontRecord {
  id: string;
  name: string;
  data: ArrayBuffer;
  createdAt: number;
}

export interface BackgroundRecord {
  id: string;
  name: string;
  data: ArrayBuffer;
  type: string;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("lastOpenedAt", "lastOpenedAt");
      }
      if (!db.objectStoreNames.contains(FONT_STORE)) {
        db.createObjectStore(FONT_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BACKGROUND_STORE)) {
        db.createObjectStore(BACKGROUND_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地书库"));
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("书库操作失败"));
  });
}

export async function listBooks(): Promise<BookMeta[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const records = await requestToPromise(tx.objectStore(STORE).getAll() as IDBRequest<BookRecord[]>);
  return records
    .map(normalizeRecord)
    .filter((record) => !record.deletedAt)
    .map(({ data: _data, ...meta }) => meta)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt || b.addedAt - a.addedAt);
}

export async function listDeletedBooks(): Promise<BookMeta[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const records = await requestToPromise(tx.objectStore(STORE).getAll() as IDBRequest<BookRecord[]>);
  return records
    .map(normalizeRecord)
    .filter((record) => record.deletedAt)
    .map(({ data: _data, ...meta }) => meta)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

export async function trashBook(id: string): Promise<void> {
  const record = await getBook(id);
  if (record) await putBook({ ...record, deletedAt: Date.now() });
}

export async function restoreBook(id: string): Promise<void> {
  const record = await getBook(id);
  if (!record) return;
  const { deletedAt: _deletedAt, ...restored } = record;
  await putBook(restored);
}

export async function purgeExpiredTrash(days = 30): Promise<void> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const deleted = await listDeletedBooks();
  for (const book of deleted) {
    if ((book.deletedAt ?? 0) < cutoff) await deleteBook(book.id);
  }
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const record = await requestToPromise(tx.objectStore(STORE).get(id) as IDBRequest<BookRecord | undefined>);
  return record ? normalizeRecord(record) : undefined;
}

function normalizeRecord(record: BookRecord): BookRecord {
  const format = record.format ?? formatFromFileName(record.fileName);
  const normalized: BookRecord = { ...record, format };

  // Older TXT imports were stored with the whole filename as the title and
  // "未知作者". Recover title/author when the filename carries them.
  if (format === "txt" && (!record.author || record.author === "未知作者")) {
    const parsed = parseBookFileName(record.fileName);
    if (parsed.author) {
      normalized.author = parsed.author;
      if (!record.title || record.title === legacyTitle(record.fileName)) {
        normalized.title = parsed.title;
      }
    }
  }

  return normalized;
}

function legacyTitle(fileName: string): string {
  return fileName
    .replace(/\.(txt|epub)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

export async function putBook(record: BookRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await requestToPromise(tx.objectStore(STORE).put(record));
}

export async function deleteBook(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  await requestToPromise(tx.objectStore(STORE).delete(id));
}

export async function putFont(record: FontRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(FONT_STORE, "readwrite");
  await requestToPromise(tx.objectStore(FONT_STORE).put(record));
}

export async function listFonts(): Promise<FontRecord[]> {
  const db = await openDb();
  const tx = db.transaction(FONT_STORE, "readonly");
  return requestToPromise(
    tx.objectStore(FONT_STORE).getAll() as IDBRequest<FontRecord[]>,
  );
}

export async function getFont(id: string): Promise<FontRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction(FONT_STORE, "readonly");
  return requestToPromise(
    tx.objectStore(FONT_STORE).get(id) as IDBRequest<FontRecord | undefined>,
  );
}

export async function deleteFont(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(FONT_STORE, "readwrite");
  await requestToPromise(tx.objectStore(FONT_STORE).delete(id));
}

export async function putBackground(record: BackgroundRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BACKGROUND_STORE, "readwrite");
  await requestToPromise(tx.objectStore(BACKGROUND_STORE).put(record));
}

export async function listBackgrounds(): Promise<BackgroundRecord[]> {
  const db = await openDb();
  const tx = db.transaction(BACKGROUND_STORE, "readonly");
  return requestToPromise(
    tx.objectStore(BACKGROUND_STORE).getAll() as IDBRequest<BackgroundRecord[]>,
  );
}

export async function getBackground(id: string): Promise<BackgroundRecord | undefined> {
  const db = await openDb();
  const tx = db.transaction(BACKGROUND_STORE, "readonly");
  return requestToPromise(
    tx.objectStore(BACKGROUND_STORE).get(id) as IDBRequest<
      BackgroundRecord | undefined
    >,
  );
}

export async function deleteBackground(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BACKGROUND_STORE, "readwrite");
  await requestToPromise(tx.objectStore(BACKGROUND_STORE).delete(id));
}
