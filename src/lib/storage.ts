import type { FontWeight, Progress, ReaderSettings, ThemeName } from "../types";

const SETTINGS_KEY = "moyue.settings.v1";
const PROGRESS_KEY = "moyue.progress.v1";

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "paper",
  fontSize: 19,
  lineHeight: 1.9,
  fontFamily: "serif",
  fontWeight: 400,
  readingMode: "paginated",
  shelfView: "sidebar",
  margin: 16,
  paragraphSpacing: 1,
  columns: 1,
  vertical: false,
};

export function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    return {
      theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      fontSize: clamp(Number(parsed.fontSize) || DEFAULT_SETTINGS.fontSize, 14, 30),
      lineHeight: clamp(Number(parsed.lineHeight) || DEFAULT_SETTINGS.lineHeight, 1.4, 2.4),
      fontFamily: parsed.fontFamily === "sans" ? "sans" : "serif",
      fontWeight: normalizeFontWeight(parsed.fontWeight),
      readingMode: parsed.readingMode === "scroll" ? "scroll" : "paginated",
      shelfView: parsed.shelfView === "full" ? "full" : "sidebar",
      margin: clamp(Number(parsed.margin) || DEFAULT_SETTINGS.margin, 0, 40),
      paragraphSpacing: clamp(
        Number(parsed.paragraphSpacing) || DEFAULT_SETTINGS.paragraphSpacing,
        0.2,
        2.4,
      ),
      columns: parsed.columns === 2 ? 2 : 1,
      vertical: parsed.vertical === true,
      customFontId: typeof parsed.customFontId === "string" ? parsed.customFontId : undefined,
      customFontName:
        typeof parsed.customFontName === "string" ? parsed.customFontName : undefined,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ReaderSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private windows; reading still works.
  }
}

export function loadProgressMap(): Record<string, Progress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Progress>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProgress(id: string, progress: Progress): void {
  try {
    const map = loadProgressMap();
    map[id] = progress;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // Progress is best-effort; never block reading on it.
  }
}

function isTheme(value: unknown): value is ThemeName {
  return value === "paper" || value === "night" || value === "sepia";
}

function normalizeFontWeight(value: unknown): FontWeight {
  return value === 300 || value === 500 || value === 700 ? value : 400;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
