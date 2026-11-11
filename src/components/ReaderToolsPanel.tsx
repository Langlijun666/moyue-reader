import { useState } from "react";
import type { SearchResult } from "../types";
import type { Bookmark } from "../lib/bookmarks";
import type { Highlight } from "../lib/highlights";
import { HIGHLIGHT_COLORS } from "../lib/highlights";
import { percentLabel } from "../lib/format";
import { Icon } from "./Icons";

type ToolsTab = "search" | "bookmarks" | "highlights";

interface ReaderToolsPanelProps {
  open: boolean;
  tab: ToolsTab;
  onTabChange: (tab: ToolsTab) => void;
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
  highlights: Highlight[];
  onJumpSearch: (result: SearchResult) => void;
  onAddBookmark: () => void;
  onJumpBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (id: string) => void;
  onJumpHighlight: (highlight: Highlight) => void;
  onDeleteHighlight: (id: string) => void;
  onSaveHighlightNote: (id: string, note: string) => void;
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
  highlights,
  onJumpSearch,
  onAddBookmark,
  onJumpBookmark,
  onDeleteBookmark,
  onJumpHighlight,
  onDeleteHighlight,
  onSaveHighlightNote,
  onClose,
}: ReaderToolsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  if (!open) return null;

  const startEditNote = (highlight: Highlight) => {
    setEditingId(highlight.id);
    setNoteDraft(highlight.note);
  };

  const saveNote = (id: string) => {
    onSaveHighlightNote(id, noteDraft);
    setEditingId(null);
    setNoteDraft("");
  };

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

      <div className="reader-tools__tabs reader-tools__tabs--three">
        <button
          className={tab === "search" ? "reader-tools__tab--active" : ""}
          onClick={() => onTabChange("search")}
        >
          <Icon name="search" size={14} />
          全文搜索
        </button>
        <button
          className={tab === "highlights" ? "reader-tools__tab--active" : ""}
          onClick={() => onTabChange("highlights")}
        >
          <Icon name="pen" size={14} />
          划线
          {highlights.length > 0 ? <span>{highlights.length}</span> : null}
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
      ) : tab === "highlights" ? (
        <div className="reader-tools__body">
          <p className="reader-tools__hint">
            在正文中选中文字即可划线，也可以给划线补充笔记。
          </p>

          {highlights.length === 0 ? (
            <div className="reader-tools__empty">
              <Icon name="pen" size={28} />
              <p>还没有划线。选中一段文字，给它留个记号吧。</p>
            </div>
          ) : (
            <div className="highlight-list">
              {highlights
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((item) => {
                  const color =
                    HIGHLIGHT_COLORS.find((entry) => entry.id === item.color) ??
                    HIGHLIGHT_COLORS[0];
                  return (
                    <div className="highlight-row" key={item.id}>
                      <button
                        className="highlight-row__main"
                        onClick={() => onJumpHighlight(item)}
                      >
                        <span className="highlight-row__head">
                          <span
                            className={`highlight-dot highlight-dot--${color.id}`}
                          />
                          <span className="highlight-row__chapter">{item.chapter}</span>
                          <span className="highlight-row__meta">
                            {percentLabel(item.percent)}
                          </span>
                        </span>
                        <span className="highlight-row__text">{item.text}</span>
                        {editingId !== item.id && item.note ? (
                          <span className="highlight-row__note">{item.note}</span>
                        ) : null}
                      </button>

                      {editingId === item.id ? (
                        <div className="highlight-note-editor">
                          <textarea
                            value={noteDraft}
                            autoFocus
                            maxLength={500}
                            placeholder="写点想法…"
                            onChange={(event) => setNoteDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (
                                (event.ctrlKey || event.metaKey) &&
                                event.key === "Enter"
                              ) {
                                event.preventDefault();
                                saveNote(item.id);
                              }
                            }}
                          />
                          <div className="highlight-note-editor__actions">
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setNoteDraft("");
                              }}
                            >
                              取消
                            </button>
                            <button
                              className="button button--primary"
                              onClick={() => saveNote(item.id)}
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="highlight-row__actions">
                          <button
                            className="highlight-row__action"
                            onClick={() => startEditNote(item)}
                            title="编辑笔记"
                            aria-label="编辑笔记"
                          >
                            <Icon name="pen" size={12} />
                          </button>
                          <button
                            className="highlight-row__action"
                            onClick={() => onDeleteHighlight(item.id)}
                            title="删除划线"
                            aria-label="删除划线"
                          >
                            <Icon name="trash" size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
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
