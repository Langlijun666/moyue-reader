export type ThemeName = "paper" | "night" | "sepia" | "custom";

export type FontFamily = "serif" | "sans";

export type FontWeight = 300 | 400 | 500 | 700;

export type ReadingMode = "paginated" | "scroll";

export type PageEffect = "sweep" | "curl" | "slide" | "fade" | "zoom" | "none";

export type ShelfView = "sidebar" | "full";

export type BookFormat = "epub" | "txt";

export interface ReaderSettings {
  theme: ThemeName;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamily;
  fontWeight: FontWeight;
  readingMode: ReadingMode;
  pageEffect: PageEffect;
  shelfView: ShelfView;
  margin: number;
  paragraphSpacing: number;
  columns: 1 | 2;
  vertical: boolean;
  customFontId?: string;
  customFontName?: string;
  customBackground: string;
  customText: string;
  customAccent: string;
  backgroundImageId?: string;
  backgroundImageName?: string;
  backgroundDim: number;
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

export interface SearchResult {
  id: string;
  sectionIndex: number;
  href: string;
  chapter: string;
  snippet: string;
  occurrence: number;
  query: string;
}

export interface BookRecord extends BookMeta {
  data: ArrayBuffer;
}
