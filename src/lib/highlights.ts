export type HighlightColor = "gold" | "rose" | "green" | "blue";

export interface Highlight {
  id: string;
  cfi: string;
  text: string;
  chapter: string;
  percent: number;
  color: HighlightColor;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export const HIGHLIGHT_COLORS: {
  id: HighlightColor;
  label: string;
  fill: string;
}[] = [
  { id: "gold", label: "金色", fill: "#d9a441" },
  { id: "rose", label: "粉色", fill: "#d98c8c" },
  { id: "green", label: "绿色", fill: "#7fa88a" },
  { id: "blue", label: "蓝色", fill: "#7f9fc4" },
];

const KEY = "moyue.highlights.v1";

export function loadHighlights(bookId: string): Highlight[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, Highlight[]>;
    const list = parsed?.[bookId];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.cfi === "string" &&
        item.cfi.length > 0 &&
        typeof item.text === "string",
    );
  } catch {
    return [];
  }
}

export function saveHighlights(bookId: string, highlights: Highlight[]): void {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Highlight[]>) : {};
    parsed[bookId] = highlights;
    localStorage.setItem(KEY, JSON.stringify(parsed));
  } catch {
    // Highlights are optional; reading must not depend on them.
  }
}

export function newHighlightId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `hl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

export function highlightFill(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((item) => item.id === color)?.fill ?? HIGHLIGHT_COLORS[0].fill;
}
