export interface Bookmark {
  id: string;
  cfi: string;
  percent: number;
  chapter: string;
  createdAt: number;
}

const KEY = "moyue.bookmarks.v1";

export function loadBookmarksMap(): Record<string, Bookmark[]> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Bookmark[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveBookmarksMap(map: Record<string, Bookmark[]>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Bookmarks are optional; reading must not depend on them.
  }
}

export function loadBookmarks(bookId: string): Bookmark[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, Bookmark[]>;
    const list = parsed?.[bookId];
    return Array.isArray(list)
      ? list.filter(
          (bookmark) =>
            bookmark &&
            typeof bookmark.id === "string" &&
            typeof bookmark.cfi === "string" &&
            bookmark.cfi.length > 0,
        )
      : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookId: string, bookmarks: Bookmark[]): void {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Bookmark[]>) : {};
    parsed[bookId] = bookmarks;
    localStorage.setItem(KEY, JSON.stringify(parsed));
  } catch {
    // Bookmarks are optional; reading must not depend on them.
  }
}

export function newBookmarkId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `bm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
