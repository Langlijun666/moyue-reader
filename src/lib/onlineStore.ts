import { invoke } from "@tauri-apps/api/core";

export const STORE_ORIGIN = "https://www.sudugu.cc";

export const STORE_CATEGORIES = [
  { id: "1", name: "玄幻" },
  { id: "2", name: "仙侠" },
  { id: "3", name: "都市" },
  { id: "4", name: "历史" },
  { id: "5", name: "军事" },
  { id: "6", name: "科幻" },
  { id: "7", name: "言情" },
  { id: "8", name: "轻小说" },
  { id: "9", name: "诸天无限" },
  { id: "10", name: "游戏" },
  { id: "11", name: "奇幻" },
  { id: "12", name: "悬疑" },
  { id: "13", name: "体育" },
  { id: "14", name: "官场" },
  { id: "15", name: "武侠" },
  { id: "16", name: "现实" },
] as const;

export interface StoreBook {
  id: string;
  title: string;
  author: string;
  cover?: string;
  status: string;
  category: string;
  intro?: string;
  latest?: string;
  chapterCount?: number;
  /** Stable React key for the grid. */
  key: string;
  url: string;
}

export interface StoreShelf {
  books: StoreBook[];
  page: number;
  totalPages: number;
}

interface StoreSegment {
  start: number;
  end: number;
  url: string;
}

const HEADER_LINE = /^(《.+》.*作者[：:]|章节范围[：:]|来源[：:]|网址[：:])/;
const FOOTER_LINE = /^更多精彩小说/;

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function text(node: Element | null | undefined): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function toAbsolute(href: string | null | undefined): string | undefined {
  const value = href?.trim();
  if (!value || value.startsWith("javascript:")) return undefined;
  try {
    const url = new URL(value, `${STORE_ORIGIN}/`);
    if (url.hostname !== "www.sudugu.cc") return undefined;
    // Book links on the detail page point at "/6597/#dir"; the anchor is not
    // part of the book id we need.
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizeCover(src: string | null | undefined): string | undefined {
  const url = toAbsolute(src);
  if (!url || url.includes("/modules/article/images/nocover.jpg")) return undefined;
  return url;
}

function bookId(url: string | undefined): string | undefined {
  return url ? /sudugu\.cc\/(\d+)\/?$/.exec(url)?.[1] : undefined;
}

function makeKey(id: string): string {
  return `store-${id}`;
}

function buildBook(partial: Omit<StoreBook, "key">): StoreBook {
  return { ...partial, key: makeKey(partial.id) };
}

function parseStatusSpans(item: Element | null): string[] {
  const paragraph = item?.querySelector(".itemtxt p");
  if (!paragraph) return [];
  return [...paragraph.querySelectorAll("span")].map((span) => text(span)).filter(Boolean);
}

/** Book cards in "最新 / 排行 / 完结" list pages, which always carry a cover. */
function parseListItem(item: Element): StoreBook | null {
  const titleLink = item.querySelector("h1 a, h3 a") ?? item.querySelector("a[href]");
  const url = toAbsolute(titleLink?.getAttribute("href"));
  const id = bookId(url);
  if (!url || !id) return null;
  const [status, category] = parseStatusSpans(item);
  // In list pages the author is a plain link back to the book, not an
  // authorarticle.php link, so read the "作者：" paragraph instead.
  const authorLine = [...item.querySelectorAll(".itemtxt p")]
    .map((paragraph) => text(paragraph))
    .find((line) => line.startsWith("作者"));
  const author = authorLine?.replace(/^作者[：:]\s*/, "") ?? "";
  const latest = text(item.querySelector("ul li a")) || undefined;
  return buildBook({
    id,
    title: text(titleLink) || "未命名",
    author: author || "未知作者",
    cover: normalizeCover(item.querySelector("img")?.getAttribute("src")),
    status: status ?? "",
    category: category ?? "",
    latest,
    url,
  });
}

function parseSearchItem(item: Element): StoreBook | null {
  const titleLink = item.querySelector("h3 a") ?? item.querySelector("a[href]");
  const url = toAbsolute(titleLink?.getAttribute("href"));
  const id = bookId(url);
  if (!url || !id) return null;
  const listItems = [...item.querySelectorAll("li")].map((node) => text(node));
  const authorLine = listItems.find((line) => line.startsWith("作者"));
  const updateLine = text(item.querySelector("li a")) || undefined;
  const intro = text(item.querySelector("p")).replace(/^简介[：:]\s*/, "") || undefined;
  return buildBook({
    id,
    title: text(titleLink) || "未命名",
    author: authorLine?.replace(/^作者[：:]\s*/, "") || "未知作者",
    status: "",
    category: "",
    intro,
    latest: updateLine,
    url,
  });
}

function parseDetail(doc: Document, fallback?: StoreBook): StoreBook | null {
  const item = doc.querySelector(".item");
  const url =
    toAbsolute(item?.querySelector("h1 a")?.getAttribute("href")) ?? fallback?.url;
  const id = bookId(url) ?? fallback?.id;
  if (!url || !id) return null;
  const [status, category] = parseStatusSpans(item ?? doc.body);
  const heading = doc.querySelector("h1");
  const chapterLinks = [...doc.querySelectorAll("#list li a")];
  const intro = text(doc.querySelector("div.des"));
  return buildBook({
    id,
    title: text(item?.querySelector("h1 a")) || fallback?.title || text(heading) || "未命名",
    author:
      text(doc.querySelector('a[href*="authorarticle.php"]'))
        .replace(/^作者[：:]\s*/, "") ||
      fallback?.author ||
      "未知作者",
    cover:
      normalizeCover(item?.querySelector("img")?.getAttribute("src")) ?? fallback?.cover,
    status: status || fallback?.status || "",
    category: category || fallback?.category || "",
    intro: intro || undefined,
    latest: text(chapterLinks[chapterLinks.length - 1]) || fallback?.latest,
    chapterCount: chapterLinks.length,
    url,
  });
}

/** Books in one category page, e.g. /fenlei/3/2/ (都市 · 第 2 页). */
export async function loadCategory(categoryId: string, page: number): Promise<StoreShelf> {
  const html = await invoke<string>("fetch_store_page", {
    url: `${STORE_ORIGIN}/fenlei/${categoryId}/${page}/`,
  });
  const doc = parseHtml(html);
  const headings = [...doc.querySelectorAll("h1.h2")];
  const container = headings[headings.length - 1]?.parentElement ?? doc.body;
  const books = [...container.querySelectorAll("div.item")]
    .map(parseListItem)
    .filter((book): book is StoreBook => book !== null);
  const pager = text(doc.querySelector(".page"));
  const totalPages = Math.max(1, Number(/(\d+)\s*\/\s*(\d+)/.exec(pager)?.[2] ?? 1));
  return { books, page, totalPages };
}

/** Search by full book name (the site does not support fuzzy matching). */
export async function searchStore(term: string): Promise<StoreBook[]> {
  const html = await invoke<string>("fetch_store_page", {
    url: `${STORE_ORIGIN}/modules/article/search.php?searchkey=${encodeURIComponent(term)}`,
  });
  const doc = parseHtml(html);
  // An exact hit can answer with the book detail page instead of a result list.
  if (doc.querySelector("#list") || doc.querySelector(".item h1")) {
    const detail = parseDetail(doc);
    return detail ? [detail] : [];
  }
  return [...doc.querySelectorAll(".content .item")]
    .map(parseSearchItem)
    .filter((book): book is StoreBook => book !== null);
}

export async function loadBookDetail(book: StoreBook): Promise<StoreBook> {
  const html = await invoke<string>("fetch_store_page", {
    url: `${STORE_ORIGIN}/${book.id}/`,
  });
  return parseDetail(parseHtml(html), book) ?? book;
}

async function loadSegments(id: string): Promise<StoreSegment[]> {
  const html = await invoke<string>("fetch_store_page", {
    url: `${STORE_ORIGIN}/${id}/txt.html`,
  });
  const doc = parseHtml(html);
  const links = [...doc.querySelectorAll('a[href*="packdown.php"]')]
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .map((href) => toAbsolute(href) ?? "")
    .filter(Boolean);
  const segments = links
    .filter((href) => /[?&]start=\d+/.test(href) && /[?&]end=\d+/.test(href))
    .map((href) => {
      const url = new URL(href);
      return {
        start: Number(url.searchParams.get("start")),
        end: Number(url.searchParams.get("end")),
        url: url.toString(),
      };
    })
    .filter((segment) => Number.isFinite(segment.start) && segment.start > 0)
    .sort((left, right) => left.start - right.start);
  const seen = new Set<number>();
  const unique = segments.filter((segment) => {
    if (seen.has(segment.start)) return false;
    seen.add(segment.start);
    return true;
  });
  if (unique.length > 0) return unique;

  // Very short books may only offer the whole-book pack.
  const whole = links.find((href) => !/[?&]start=/.test(href));
  return whole ? [{ start: 1, end: 0, url: whole }] : [];
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeSegment(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // The store packs TXT as GBK (content-type says charset=GBK).
    return new TextDecoder("gb18030").decode(bytes);
  }
}

/**
 * Each packed segment repeats a small header and footer. Drop them so a
 * multi-segment book reads as one continuous text.
 */
function cleanSegment(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let start = 0;
  while (start < lines.length) {
    const line = lines[start].trim();
    if (line !== "" && !HEADER_LINE.test(line)) break;
    start += 1;
  }
  let end = lines.length;
  while (end > start) {
    const line = lines[end - 1].trim();
    if (line === "" || FOOTER_LINE.test(line)) {
      end -= 1;
      continue;
    }
    break;
  }
  return lines.slice(start, end).join("\n").trim();
}

function safeFileNamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFileName(book: StoreBook): string {
  const title = safeFileNamePart(book.title).slice(0, 60) || "未命名";
  const author = safeFileNamePart(book.author).slice(0, 30);
  if (!author || author === "未知作者") return `${title}.txt`;
  return `${title}_${author}.txt`;
}

/**
 * Download every TXT segment, decode it, drop the store's header/footer and
 * turn the result into a plain UTF-8 .txt File that the library can import.
 */
export async function downloadStoreBook(
  book: StoreBook,
  onProgress: (done: number, total: number) => void,
): Promise<File> {
  const segments = await loadSegments(book.id);
  if (segments.length === 0) {
    throw new Error("这本书暂时没有提供 TXT 下载");
  }
  const parts: string[] = [];
  for (let index = 0; index < segments.length; index += 1) {
    onProgress(index + 1, segments.length);
    const encoded = await invoke<string>("fetch_store_segment", {
      url: segments[index].url,
    });
    const part = cleanSegment(decodeSegment(base64ToBytes(encoded)));
    if (part) parts.push(part);
  }
  const content = parts.join("\n\n");
  if (!content.trim()) throw new Error("下载到的内容为空");
  const bytes = new TextEncoder().encode(content);
  return new File([bytes], buildFileName(book), { type: "text/plain" });
}

export async function openStorePage(url: string): Promise<void> {
  await invoke("open_store_page", { url });
}
