import { useEffect, useMemo, useState } from "react";
import {
  bestStreak,
  currentStreak,
  dateKey,
  formatDuration,
  formatShortDuration,
  loadStats,
  recentDays,
  secondsInLastDays,
  totalPages,
  totalSeconds,
  type ReadingStats,
} from "../lib/stats";
import { Icon } from "./Icons";

interface StatsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function StatsDialog({ open, onClose }: StatsDialogProps) {
  const [stats, setStats] = useState<ReadingStats>(() => loadStats());

  useEffect(() => {
    if (open) setStats(loadStats());
  }, [open]);

  const heatmap = useMemo(() => recentDays(stats, 182), [stats]);
  const lastWeek = useMemo(() => recentDays(stats, 7), [stats]);
  const total = useMemo(() => totalSeconds(stats), [stats]);
  const pages = useMemo(() => totalPages(stats), [stats]);
  const today = stats.days[dateKey()] ?? { seconds: 0, pages: 0 };
  const weekSeconds = secondsInLastDays(stats, 7);
  const monthSeconds = secondsInLastDays(stats, 30);
  const streak = currentStreak(stats);
  const best = bestStreak(stats);
  const books = Object.entries(stats.books)
    .map(([id, book]) => ({ id, ...book }))
    .filter((book) => book.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);
  const maxBookSeconds = Math.max(1, ...books.map((book) => book.seconds));
  const maxDaySeconds = Math.max(1, ...lastWeek.map((day) => day.seconds));
  const hasData = total > 0 || pages > 0;

  if (!open) return null;

  return (
    <div className="stats-backdrop" onClick={onClose}>
      <section
        className="stats-dialog"
        role="dialog"
        aria-label="阅读统计"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stats-dialog__header">
          <div>
            <span className="eyebrow">READING STATS</span>
            <h3>阅读统计</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭阅读统计">
            <Icon name="x" size={18} />
          </button>
        </header>

        {!hasData ? (
          <div className="stats-empty">
            <Icon name="chart" size={36} />
            <h4>还没有阅读记录</h4>
            <p>打开一本书读几分钟，这里会开始记录你的阅读时间。</p>
          </div>
        ) : (
          <div className="stats-dialog__body">
            <div className="stats-cards">
              <div className="stats-card">
                <span>今天</span>
                <strong>{formatDuration(today.seconds)}</strong>
                <small>{today.pages} 页</small>
              </div>
              <div className="stats-card">
                <span>最近 7 天</span>
                <strong>{formatDuration(weekSeconds)}</strong>
                <small>近 30 天 {formatDuration(monthSeconds)}</small>
              </div>
              <div className="stats-card">
                <span>连续阅读</span>
                <strong>{streak} 天</strong>
                <small>最长 {best} 天</small>
              </div>
              <div className="stats-card">
                <span>累计</span>
                <strong>{formatDuration(total)}</strong>
                <small>{pages} 页 · {books.length > 0 ? `${Object.keys(stats.books).length} 本` : "0 本"}</small>
              </div>
            </div>

            <div className="stats-section">
              <div className="stats-section__head">
                <h4>最近 7 天</h4>
                <span>每天阅读时长</span>
              </div>
              <div className="stats-bars">
                {lastWeek.map((day) => {
                  const value = day.seconds;
                  const height =
                    value > 0
                      ? Math.max(8, Math.round((value / maxDaySeconds) * 100))
                      : 2;
                  const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(
                    "zh-CN",
                    { weekday: "short" },
                  );
                  return (
                    <div className="stats-bar" key={day.date}>
                      <div className="stats-bar__track">
                        <span
                          className={value > 0 ? "stats-bar__fill" : "stats-bar__fill stats-bar__fill--empty"}
                          style={{ height: `${height}%` }}
                          title={`${day.date} · ${formatDuration(value)}`}
                        />
                      </div>
                      <small>{label}</small>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="stats-section">
              <div className="stats-section__head">
                <h4>阅读热力图</h4>
                <span>最近半年</span>
              </div>
              <div className="stats-heatmap-wrap">
                <div className="stats-heatmap">
                  {heatmap.map((day) => {
                    const minutes = day.seconds / 60;
                    const level =
                      minutes >= 60
                        ? 4
                        : minutes >= 30
                          ? 3
                          : minutes >= 10
                            ? 2
                            : minutes > 0
                              ? 1
                              : 0;
                    return (
                      <span
                        key={day.date}
                        className={`stats-heatmap__cell stats-heatmap__cell--${level}`}
                        title={`${day.date} · ${formatDuration(day.seconds)}`}
                      />
                    );
                  })}
                </div>
                <div className="stats-heatmap__legend">
                  <span>少</span>
                  <i className="stats-heatmap__cell stats-heatmap__cell--0" />
                  <i className="stats-heatmap__cell stats-heatmap__cell--1" />
                  <i className="stats-heatmap__cell stats-heatmap__cell--2" />
                  <i className="stats-heatmap__cell stats-heatmap__cell--3" />
                  <i className="stats-heatmap__cell stats-heatmap__cell--4" />
                  <span>多</span>
                </div>
              </div>
            </div>

            {books.length > 0 ? (
              <div className="stats-section">
                <div className="stats-section__head">
                  <h4>读得最多的书</h4>
                  <span>按阅读时长</span>
                </div>
                <div className="stats-books">
                  {books.map((book) => (
                    <div className="stats-book" key={book.id}>
                      <span className="stats-book__title" title={book.title}>
                        {book.title}
                      </span>
                      <span className="stats-book__time">
                        {formatShortDuration(book.seconds)}
                      </span>
                      <span className="stats-book__track">
                        <i
                          style={{
                            width: `${Math.max(4, Math.round((book.seconds / maxBookSeconds) * 100))}%`,
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
