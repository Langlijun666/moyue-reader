import ePub from "epubjs";
import type { BookFormat } from "../types";
import { parseBookFileName } from "./filename";

export interface InspectedBook {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  description?: string;
  cover?: string;
}

export async function inspectEpub(data: ArrayBuffer, fileName: string): Promise<InspectedBook> {
  const book = ePub(data.slice(0));
  try {
    await book.ready;
    const metadata = await book.loaded.metadata;
    let cover: string | undefined;

    try {
      const coverUrl = await book.coverUrl();
      if (coverUrl) {
        cover = await imageUrlToDataUrl(coverUrl);
      }
    } catch {
      // A book without a usable cover is still perfectly readable.
    }

    const fallback = parseBookFileName(fileName);
    return {
      id: await sha256Hex(data),
      title: cleanText(metadata.title) || fallback.title || "未命名书籍",
      author: cleanText(metadata.creator) || fallback.author || "未知作者",
      format: "epub",
      description: cleanText(metadata.description) || undefined,
      cover,
    };
  } finally {
    try {
      book.destroy();
    } catch {
      // epub.js can throw while tearing down a partially loaded book.
    }
  }
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function imageUrlToDataUrl(url: string): Promise<string | undefined> {
  const response = await fetch(url);
  if (!response.ok) return undefined;
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("封面读取失败"));
    reader.readAsDataURL(blob);
  });
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}
