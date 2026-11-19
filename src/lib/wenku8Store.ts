import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const OPDS_BASE = "https://opds.wol.moe/zh_CN";

export interface Wenku8Book {
  id: string;
  title: string;
  author: string;
  summary: string;
  coverUrl?: string;
  epubUrl: string;
  updated?: string;
}

export interface Wenku8FeedResult {
  books: Wenku8Book[];
  title: string;
  page: number;
  hasNext: boolean;
}

export const WENKU8_FEEDS = [
  { id: "lastUpdate", label: "最近更新", path: "lastUpdate.xml" },
  { id: "allVisit", label: "总榜", path: "allVisit.xml" },
  { id: "monthVisit", label: "月榜", path: "monthVisit.xml" },
  { id: "weekVisit", label: "周榜", path: "weekVisit.xml" },
  { id: "fullFlag", label: "完本", path: "fullFlag.xml" },
  { id: "goodNum", label: "收藏", path: "goodNum.xml" },
] as const;

function childText(element: Element, tag: string): string {
  return element.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
}

function linkHref(entry: Element, relPart: string): string | undefined {
  const links = [...entry.getElementsByTagName("link")];
  return links
    .find((link) => (link.getAttribute("rel") ?? "").includes(relPart))
    ?.getAttribute("href") ?? undefined;
}

function parseEntries(xml: string): Wenku8Book[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("轻小说目录解析失败");
  }
  return [...doc.getElementsByTagName("entry")]
    .map((entry): Wenku8Book | null => {
      const epubUrl = linkHref(entry, "acquisition");
      const title = childText(entry, "title");
      if (!epubUrl || !title) return null;
      const authorNode = entry.getElementsByTagName("author")[0];
      const author = authorNode ? childText(authorNode, "name") : "";
      const rawId = childText(entry, "id");
      return {
        id: rawId.replace(/^urn:wenku8articleid:/, ""),
        title,
        author,
        summary: childText(entry, "summary"),
        coverUrl: linkHref(entry, "image"),
        epubUrl,
        updated: childText(entry, "updated") || undefined,
      };
    })
    .filter((book): book is Wenku8Book => book !== null);
}

function parseFeed(xml: string, page: number): Wenku8FeedResult {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("轻小说目录解析失败");
  }
  const feed = doc.documentElement;
  const hasNext = [...feed.getElementsByTagName("link")].some(
    (link) => link.getAttribute("rel") === "next",
  );
  return {
    books: parseEntries(xml),
    title: childText(feed, "title") || "轻小说文库",
    page,
    hasNext,
  };
}

export async function loadWenku8Feed(path: string, page: number): Promise<Wenku8FeedResult> {
  const query = page > 1 ? `?page=${page}` : "";
  const xml = await invoke<string>("fetch_store_page", {
    url: `${OPDS_BASE}/${path}${query}`,
  });
  return parseFeed(xml, page);
}

export async function searchWenku8(term: string): Promise<Wenku8FeedResult> {
  const xml = await invoke<string>("fetch_store_page", {
    url: `${OPDS_BASE}/search.opds?q=${encodeURIComponent(term)}`,
  });
  const feed = parseFeed(xml, 1);
  return { ...feed, title: `“${term}”的搜索结果`, hasNext: false };
}

function safeFileName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, "_").trim();
  return `${(cleaned || "wenku8-book").slice(0, 80)}.epub`;
}

export interface Wenku8DownloadSource {
  name: string;
  path: string;
}

export interface Wenku8DownloadHandle {
  sources: Wenku8DownloadSource[];
  finish: () => Promise<void>;
}

export async function downloadWenku8Epub(
  book: Wenku8Book,
  onProgress: (done: number, total: number) => void,
): Promise<Wenku8DownloadHandle> {
  const unlisten = await listen<{ downloaded: number; total: number }>(
    "wenku8-download-progress",
    (event) => onProgress(event.payload.downloaded, event.payload.total),
  );
  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    unlisten();
    await invoke("clear_wenku8_cache").catch(() => undefined);
  };
  try {
    const path = await invoke<string>("download_wenku8_epub", { url: book.epubUrl });
    const split = await invoke<Wenku8DownloadSource[]>("split_downloaded_epub", {
      path,
    });
    const sources = split.length
      ? split
      : [{ name: safeFileName(book.title), path }];
    if (!sources.length) throw new Error("没有可导入的 EPUB");
    return { sources, finish };
  } catch (error) {
    await finish();
    throw error;
  }
}

export async function readWenku8Source(source: Wenku8DownloadSource): Promise<File> {
  const response = await fetch(convertFileSrc(source.path));
  if (!response.ok) throw new Error("EPUB 读取失败");
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("下载到的 EPUB 为空");
  return new File([blob], source.name || "wenku8-book.epub", {
    type: "application/epub+zip",
  });
}