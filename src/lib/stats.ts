export interface DayStats {
  seconds: number;
  pages: number;
}

export interface BookStats {
  title: string;
  seconds: number;
  pages: number;
  lastReadAt: number;
}

export interface ReadingStats {
  days: Record<string, DayStats>;
  books: Record<string, BookStats>;
}

const KEY = "moyue.stats.v1";

export function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadStats(): ReadingStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { days: {}, books: {} };
    const parsed = JSON.parse(raw) as ReadingStats;
    if (!parsed || typeof parsed !== "object") return { days: {}, books: {} };
    return {
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
      books: parsed.books && typeof parsed.books === "object" ? parsed.books : {},
    };
  } catch {
    return { days: {}, books: {} };
  }
}

export function saveStats(stats: ReadingStats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // Statistics are optional; reading must not depend on them.
  }
}

export function recordReading(
  bookId: string,
  title: string,
  seconds: number,
  pages: number,
): void {
  if (!bookId || (seconds <= 0 && pages <= 0)) return;
  const stats = loadStats();
  const key = dateKey();
  const day = stats.days[key] ?? { seconds: 0, pages: 0 };
  day.seconds += Math.max(0, Math.round(seconds));
  day.pages += Math.max(0, pages);
  stats.days[key] = day;

  const book = stats.books[bookId] ?? {
    title,
    seconds: 0,
    pages: 0,
    lastReadAt: 0,
  };
  book.title = title || book.title;
  book.seconds += Math.max(0, Math.round(seconds));
  book.pages += Math.max(0, pages);
  book.lastReadAt = Date.now();
  stats.books[bookId] = book;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 730);
  const oldest = dateKey(cutoff);
  for (const date of Object.keys(stats.days)) {
    if (date < oldest) delete stats.days[date];
  }
  saveStats(stats);
}

export function totalSeconds(stats: ReadingStats): number {
  return Object.values(stats.days).reduce((sum, day) => sum + day.seconds, 0);
}

export function totalPages(stats: ReadingStats): number {
  return Object.values(stats.days).reduce((sum, day) => sum + day.pages, 0);
}

export function secondsInLastDays(stats: ReadingStats, days: number): number {
  let total = 0;
  const cursor = new Date();
  for (let index = 0; index < days; index += 1) {
    total += stats.days[dateKey(cursor)]?.seconds ?? 0;
    cursor.setDate(cursor.getDate() - 1);
  }
  return total;
}

export function currentStreak(stats: ReadingStats): number {
  const cursor = new Date();
  if ((stats.days[dateKey(cursor)]?.seconds ?? 0) < 60) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while ((stats.days[dateKey(cursor)]?.seconds ?? 0) >= 60) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function bestStreak(stats: ReadingStats): number {
  const dates = Object.keys(stats.days)
    .filter((date) => (stats.days[date]?.seconds ?? 0) >= 60)
    .sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const date of dates) {
    const current = new Date(`${date}T00:00:00`);
    if (previous) {
      const gap = Math.round(
        (current.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000),
      );
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    previous = current;
  }
  return best;
}

export function recentDays(stats: ReadingStats, count: number) {
  const result: { date: string; seconds: number; pages: number }[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (count - 1));
  for (let index = 0; index < count; index += 1) {
    const key = dateKey(cursor);
    const day = stats.days[key] ?? { seconds: 0, pages: 0 };
    result.push({ date: key, seconds: day.seconds, pages: day.pages });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function formatDuration(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return "不足 1 分钟";
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

export function formatShortDuration(seconds: number): string {
  const value = Math.max(0, Math.round(seconds));
  if (value < 60) return "<1m";
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export function mergeStats(current: ReadingStats, incoming: ReadingStats): ReadingStats {
  const days = { ...current.days };
  for (const [date, incomingDay] of Object.entries(incoming.days ?? {})) {
    const existing = days[date];
    days[date] = existing
      ? {
          seconds: Math.max(existing.seconds, incomingDay.seconds),
          pages: Math.max(existing.pages, incomingDay.pages),
        }
      : incomingDay;
  }
  const books = { ...current.books };
  for (const [id, incomingBook] of Object.entries(incoming.books ?? {})) {
    const existing = books[id];
    books[id] = existing
      ? {
          ...existing,
          title: existing.title || incomingBook.title,
          seconds: Math.max(existing.seconds, incomingBook.seconds),
          pages: Math.max(existing.pages, incomingBook.pages),
          lastReadAt: Math.max(existing.lastReadAt, incomingBook.lastReadAt),
        }
      : incomingBook;
  }
  return { days, books };
}
