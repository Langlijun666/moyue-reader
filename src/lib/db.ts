import type { BookMeta, BookRecord } from "../types";
import { formatFromFileName } from "./format";
import { parseBookFileName } from "./filename";

const DB_NAME = "moyue-library";
const DB_VERSION = 1;
const STORE = "books";

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
    .map(({ data: _data, ...meta }) => meta)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt || b.addedAt - a.addedAt);
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
