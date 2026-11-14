import JSZip from "jszip";
import { getBook, listBackgrounds, listFonts } from "./db";
import type {
  BackgroundRecord,
  FontRecord,
} from "./db";
import { loadBookmarksMap } from "./bookmarks";
import type { Bookmark } from "./bookmarks";
import { loadHighlightsMap } from "./highlights";
import type { Highlight } from "./highlights";
import { loadStats } from "./stats";
import type { ReadingStats } from "./stats";
import type { BookMeta, BookRecord, Progress, ReaderSettings } from "../types";
import type { CategoryData } from "./categories";

export interface BackupFontMeta {
  id: string;
  name: string;
  createdAt: number;
  file: string;
}

export interface BackupBackgroundMeta {
  id: string;
  name: string;
  type: string;
  createdAt: number;
  file: string;
}

export interface BackupManifest {
  format: "moyue-backup";
  version: 1 | 2;
  createdAt: number;
  appVersion: string;
  books: BookMeta[];
  progress: Record<string, Progress>;
  categories: CategoryData;
  settings: ReaderSettings;
  bookmarks?: Record<string, Bookmark[]>;
  highlights?: Record<string, Highlight[]>;
  stats?: ReadingStats;
  fonts?: BackupFontMeta[];
  backgrounds?: BackupBackgroundMeta[];
}

export interface RestoredBackup {
  manifest: BackupManifest;
  records: BookRecord[];
  fonts: FontRecord[];
  backgrounds: BackgroundRecord[];
}

const MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;

function safeId(id: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(id);
}

function backgroundExtension(record: BackgroundRecord): string {
  return backgroundExtensionFromType(record.type);
}

function backgroundExtensionFromType(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "jpg";
}

export async function createBackupBase64(
  books: BookMeta[],
  progress: Record<string, Progress>,
  categories: CategoryData,
  settings: ReaderSettings,
  appVersion: string,
): Promise<string> {
  const zip = new JSZip();
  const records: BookRecord[] = [];
  const [fonts, backgrounds] = await Promise.all([listFonts(), listBackgrounds()]);

  for (const book of books) {
    const record = await getBook(book.id);
    if (!record) continue;
    records.push(record);
  }

  const fontMeta: BackupFontMeta[] = [];
  const backgroundMeta: BackupBackgroundMeta[] = [];

  for (const font of fonts) {
    if (!safeId(font.id)) continue;
    const file = `extras/fonts/${font.id}.font`;
    zip.file(file, font.data, { binary: true, compression: "STORE" });
    fontMeta.push({ id: font.id, name: font.name, createdAt: font.createdAt, file });
  }

  for (const background of backgrounds) {
    if (!safeId(background.id)) continue;
    const file = `extras/backgrounds/${background.id}.${backgroundExtension(background)}`;
    zip.file(file, background.data, { binary: true, compression: "STORE" });
    backgroundMeta.push({
      id: background.id,
      name: background.name,
      type: background.type,
      createdAt: background.createdAt,
      file,
    });
  }

  const bookmarks = loadBookmarksMap();
  const highlights = loadHighlightsMap();
  const stats = loadStats();
  zip.file("extras/bookmarks.json", JSON.stringify(bookmarks, null, 2), {
    compression: "DEFLATE",
  });
  zip.file("extras/highlights.json", JSON.stringify(highlights, null, 2), {
    compression: "DEFLATE",
  });
  zip.file("extras/stats.json", JSON.stringify(stats, null, 2), {
    compression: "DEFLATE",
  });

  const manifest: BackupManifest = {
    format: "moyue-backup",
    version: 2,
    createdAt: Date.now(),
    appVersion,
    books: records.map(({ data: _data, ...meta }) => meta),
    progress,
    categories,
    settings,
    bookmarks,
    highlights,
    stats,
    fonts: fontMeta,
    backgrounds: backgroundMeta,
  };

  for (const record of records) {
    const extension =
      record.format === "txt" ? "txt" : record.format === "pdf" ? "pdf" : "epub";
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

  if (
    manifest.format !== "moyue-backup" ||
    (manifest.version !== 1 && manifest.version !== 2)
  ) {
    throw new Error("备份格式不受支持");
  }
  if (!Array.isArray(manifest.books)) {
    throw new Error("备份中没有书籍列表");
  }

  const records: BookRecord[] = [];
  for (const raw of manifest.books) {
    if (!raw || typeof raw.id !== "string" || !safeId(raw.id)) {
      throw new Error("备份中包含无效的书籍编号");
    }
    const format =
      raw.format === "txt" ? "txt" : raw.format === "pdf" ? "pdf" : raw.format === "epub" ? "epub" : null;
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

  const fonts: FontRecord[] = [];
  for (const meta of Array.isArray(manifest.fonts) ? manifest.fonts : []) {
    if (!meta || !safeId(meta.id)) continue;
    const entry = zip.file(meta.file) ?? zip.file(`extras/fonts/${meta.id}.font`);
    if (!entry) continue;
    fonts.push({
      id: meta.id,
      name: typeof meta.name === "string" ? meta.name : "导入字体",
      createdAt: Number(meta.createdAt) || Date.now(),
      data: await entry.async("arraybuffer"),
    });
  }

  const backgrounds: BackgroundRecord[] = [];
  for (const meta of Array.isArray(manifest.backgrounds) ? manifest.backgrounds : []) {
    if (!meta || !safeId(meta.id)) continue;
    const entry =
      zip.file(meta.file) ??
      zip.file(`extras/backgrounds/${meta.id}.${backgroundExtensionFromType(meta.type)}`);
    if (!entry) continue;
    backgrounds.push({
      id: meta.id,
      name: typeof meta.name === "string" ? meta.name : "导入背景",
      type: typeof meta.type === "string" ? meta.type : "image/jpeg",
      createdAt: Number(meta.createdAt) || Date.now(),
      data: await entry.async("arraybuffer"),
    });
  }

  const readJson = async <T>(path: string, fallback: T): Promise<T> => {
    const entry = zip.file(path);
    if (!entry) return fallback;
    try {
      return JSON.parse(await entry.async("string")) as T;
    } catch {
      return fallback;
    }
  };

  let bookmarks = manifest.bookmarks;
  let highlights = manifest.highlights;
  let stats = manifest.stats;
  if (manifest.version >= 2) {
    bookmarks = await readJson<Record<string, Bookmark[]>>(
      "extras/bookmarks.json",
      bookmarks ?? {},
    );
    highlights = await readJson<Record<string, Highlight[]>>(
      "extras/highlights.json",
      highlights ?? {},
    );
    stats = await readJson<ReadingStats>("extras/stats.json", stats ?? { days: {}, books: {} });
  }

  return {
    manifest: {
      ...manifest,
      books: records.map(({ data: _data, ...meta }) => meta),
      progress,
      categories,
      settings: settings as ReaderSettings,
      bookmarks: bookmarks ?? {},
      highlights: highlights ?? {},
      stats: stats ?? { days: {}, books: {} },
      fonts: manifest.fonts ?? [],
      backgrounds: manifest.backgrounds ?? [],
    },
    records,
    fonts,
    backgrounds,
  };
}
