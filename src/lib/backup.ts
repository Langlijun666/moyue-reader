import JSZip from "jszip";
import { getBook } from "./db";
import type { BookMeta, BookRecord, Progress, ReaderSettings } from "../types";
import type { CategoryData } from "./categories";

export interface BackupManifest {
  format: "moyue-backup";
  version: 1;
  createdAt: number;
  appVersion: string;
  books: BookMeta[];
  progress: Record<string, Progress>;
  categories: CategoryData;
  settings: ReaderSettings;
}

export interface RestoredBackup {
  manifest: BackupManifest;
  records: BookRecord[];
}

const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;

export async function createBackupBase64(
  books: BookMeta[],
  progress: Record<string, Progress>,
  categories: CategoryData,
  settings: ReaderSettings,
  appVersion: string,
): Promise<string> {
  const zip = new JSZip();
  const records: BookRecord[] = [];

  for (const book of books) {
    const record = await getBook(book.id);
    if (!record) continue;
    records.push(record);
  }

  const manifest: BackupManifest = {
    format: "moyue-backup",
    version: 1,
    createdAt: Date.now(),
    appVersion,
    books: records.map(({ data: _data, ...meta }) => meta),
    progress,
    categories,
    settings,
  };

  for (const record of records) {
    const extension = record.format === "txt" ? "txt" : "epub";
    zip.file(`books/${record.id}.${extension}`, record.data, {
      binary: true,
      compression: "STORE",
    });
  }
  zip.file("manifest.json", JSON.stringify(manifest, null, 2), {
    compression: "DEFLATE",
  });

  return zip.generateAsync({
    type: "base64",
    compression: "STORE",
    compressionOptions: { level: 6 },
  });
}

export async function readBackupFile(file: File): Promise<RestoredBackup> {
  if (file.size <= 0) throw new Error("备份文件是空的");
  if (file.size > MAX_BACKUP_BYTES) throw new Error("备份文件过大");

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("无法读取备份文件，请确认它是墨阅导出的 ZIP");
  }

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("备份文件缺少 manifest.json");

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(await manifestFile.async("string")) as BackupManifest;
  } catch {
    throw new Error("备份清单损坏");
  }

  if (manifest.format !== "moyue-backup" || manifest.version !== 1) {
    throw new Error("备份格式不受支持");
  }
  if (!Array.isArray(manifest.books)) {
    throw new Error("备份中没有书籍列表");
  }

  const records: BookRecord[] = [];
  for (const raw of manifest.books) {
    if (!raw || typeof raw.id !== "string" || !/^[A-Za-z0-9._-]+$/.test(raw.id)) {
      throw new Error("备份中包含无效的书籍编号");
    }
    const format = raw.format === "txt" ? "txt" : raw.format === "epub" ? "epub" : null;
    if (!format) throw new Error(`《${raw.title ?? "未知书籍"}》格式无效`);
    const entry = zip.file(`books/${raw.id}.${format}`);
    if (!entry) throw new Error(`备份中缺少《${raw.title ?? "未知书籍"}》的文件`);
    const data = await entry.async("arraybuffer");
    if (data.byteLength === 0) throw new Error(`《${raw.title ?? "未知书籍"}》文件为空`);
    records.push({
      ...raw,
      format,
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "未命名书籍",
      author: typeof raw.author === "string" ? raw.author : "未知作者",
      fileName:
        typeof raw.fileName === "string" ? raw.fileName : `${raw.id}.${format}`,
      size: Number(raw.size) || data.byteLength,
      addedAt: Number(raw.addedAt) || Date.now(),
      lastOpenedAt: Number(raw.lastOpenedAt) || Date.now(),
      data,
    });
  }

  const progress =
    manifest.progress && typeof manifest.progress === "object" ? manifest.progress : {};
  const categories: CategoryData =
    manifest.categories && Array.isArray(manifest.categories.categories)
      ? manifest.categories
      : { categories: [], assignments: {} };
  const settings =
    manifest.settings && typeof manifest.settings === "object"
      ? manifest.settings
      : null;

  return {
    manifest: {
      ...manifest,
      books: records.map(({ data: _data, ...meta }) => meta),
      progress,
      categories,
      settings: settings as ReaderSettings,
    },
    records,
  };
}
