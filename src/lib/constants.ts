export const BOOK_FORMATS = ["epub", "txt", "pdf", "mobi", "azw3"] as const;
export const BOOK_EXTENSION_PATTERN = /\.(epub|txt|pdf|mobi|azw3)$/i;
export const BOOK_ACCEPT = ".epub,.txt,.pdf,.mobi,.azw3,application/epub+zip,text/plain,application/pdf";
export const BOOK_MAX_BYTES = 250 * 1024 * 1024;
export const WATCH_INTERVAL_MS = 60_000;
export const UPDATE_CHECK_DELAY_MS = 6_000;
export const PDF_DEFAULT_SCALE = 1.2;
export const PDF_SEARCH_LIMIT = 200;
export const TTS_SLEEP_FADE_MS = 15_000;

export function isBookFileName(fileName: string): boolean {
  return BOOK_EXTENSION_PATTERN.test(fileName);
}

export function fileMimeType(fileName: string): string {
  if (/\.epub$/i.test(fileName)) return "application/epub+zip";
  if (/\.pdf$/i.test(fileName)) return "application/pdf";
  if (/\.(mobi|azw3)$/i.test(fileName)) return "application/x-mobipocket-ebook";
  return "text/plain";
}
