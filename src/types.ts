export type ThemeName = "paper" | "night" | "sepia";

export type FontFamily = "serif" | "sans";

export type FontWeight = 300 | 400 | 500 | 700;

export type ReadingMode = "paginated" | "scroll";

export type BookFormat = "epub" | "txt";

export interface ReaderSettings {
  theme: ThemeName;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamily;
  fontWeight: FontWeight;
  readingMode: ReadingMode;
}

export interface BookMeta {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  cover?: string;
  fileName: string;
  size: number;
  description?: string;
  addedAt: number;
  lastOpenedAt: number;
}

export interface Progress {
  cfi: string;
  percent: number;
  chapter: string;
  updatedAt: number;
}

export interface TocEntry {
  href: string;
  label: string;
  children?: TocEntry[];
}

export interface BookRecord extends BookMeta {
  data: ArrayBuffer;
}
