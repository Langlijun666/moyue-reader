import type { SearchResult } from "../types";
import type { Bookmark } from "../lib/bookmarks";
import { percentLabel } from "../lib/format";
import { Icon } from "./Icons";

interface ReaderToolsPanelProps {
  open: boolean;
  tab: "search" | "bookmarks";
  onTabChange: (tab: "search" | "bookmarks") => void;
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  searching: boolean;
  searchDone: number;
  searchTotal: number;
  searchResults: SearchResult[];
  searchHasRun: boolean;
  searchTotalHits: number;
  currentChapter: string;
  bookmarks: Bookmark[];
  onJumpSearch: (result: SearchResult) => void;
  onAddBookmark: () => void;
  onJumpBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (id: string) => void;
  onClose: () => void;
}

export function ReaderToolsPanel({
  open,
  tab,
  onTabChange,
  query,
  onQueryChange,
  onSearch,
  searching,
  searchDone,
  searchTotal,
  searchResults,
  searchHasRun,
  searchTotalHits,
  currentChapter,
  bookmarks,
  onJumpSearch,
  onAddBookmark,
  onJumpBookmark,
  onDeleteBookmark,
  onClose,
}: ReaderToolsPanelProps) {
  if (!open) return null;

  return (
    <div className="drawer drawer--right reader-tools" role="dialog" aria-label="阅读助手">
      <div className="drawer__header">
        <div>
          <span className="eyebrow">READING TOOLS</span>
          <h3>阅读助手</h3>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭阅读助手">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="reader-tools__tabs">
        <button
          className={tab === "search" ? "reader-tools__tab--active" : ""}
          onClick={() => onTabChange("search")}
        >
          <Icon name="search" size={14} />
          全文搜索
        </button>
        <button
          className={tab === "bookmarks" ? "reader-tools__tab--active" : ""}
          onClick={() => onTabChange("bookmarks")}
        >
          <Icon name="bookmark" size={14} />
          书签
          {bookmarks.length > 0 ? <span>{bookmarks.length}</span> : null}
        </button>
      </div>

      {tab === "search" ? (
        <div className="reader-tools__body">
          <form
            className="reader-search"
            onSubmit={(event) => {
              event.preventDefault();
              onSearch();
            }}
          >
            <Icon name="search" size={15} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索这本书的内容"
              aria-label="搜索书内内容"
              autoFocus
            />
            <button type="submit" disabled={searching || query.trim().length < 2}>
              搜索
            </button>
          </form>

          {searching ? (
            <div className="reader-tools__status">
              <span className="spinner spinner--small" />
              <span>
                正在整理全书…
                {searchTotal > 0 ? ` ${searchDone} / ${searchTotal}` : ""}
              </span>
            </div>
          ) : searchHasRun ? (
            <p className="reader-tools__status">
              找到 {searchTotalHits} 处
              {searchTotalHits > searchResults.length
                ? `，显示前 ${searchResults.length} 条`
                : ""}
            </p>
          ) : (
            <p className="reader-tools__hint">
              输入至少两个字，在全书范围内查找。首次搜索会建立索引，长书可能需要几秒。
            </p>
          )}

          <div className="search-results">
            {searchResults.map((result) => (
              <button
                key={result.id}
                className="search-result"
                onClick={() => onJumpSearch(result)}
              >
                <span className="search-result__chapter">{result.chapter}</span>
                <span className="search-result__snippet">
                  {highlight(result.snippet, result.query)}
                </span>
              </button>
            ))}
            {searchHasRun && !searching && searchResults.length === 0 ? (
              <div className="reader-tools__empty">
                <Icon name="search" size={28} />
                <p>没有找到「{query.trim()}」</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="reader-tools__body">
          <button
            className="reader-bookmark-add"
            onClick={onAddBookmark}
            disabled={!currentChapter}
          >
            <Icon name="bookmark" size={15} />
            添加当前位置书签
            <small>{currentChapter}</small>
          </button>

          <div className="bookmark-list">
            {bookmarks.length === 0 ? (
              <div className="reader-tools__empty">
                <Icon name="bookmark" size={28} />
                <p>还没有书签。读到想记住的地方，添加一个吧。</p>
              </div>
            ) : (
              bookmarks
                .slice()
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((bookmark) => (
                  <div className="bookmark-row" key={bookmark.id}>
                    <button
                      className="bookmark-row__main"
                      onClick={() => onJumpBookmark(bookmark)}
                    >
                      <span className="bookmark-row__chapter">{bookmark.chapter}</span>
                      <span className="bookmark-row__meta">
                        {percentLabel(bookmark.percent)} ·{" "}
                        {new Date(bookmark.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </button>
                    <button
                      className="bookmark-row__delete"
                      onClick={() => onDeleteBookmark(bookmark.id)}
                      aria-label={`删除书签：${bookmark.chapter}`}
                      title="删除书签"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function highlight(text: string, query: string) {
  const needle = query.trim();
  if (!needle) return text;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === needle.toLowerCase() ? (
      <mark key={index}>{part}</mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}
