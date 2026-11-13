import type { BookMeta, Progress, ThemeName } from "../types";
import type { Category } from "../lib/categories";
import { formatBytes, percentLabel } from "../lib/format";
import { BookCover } from "./BookCover";
import { Icon } from "./Icons";
import { themeLabel as getThemeLabel, themePreset } from "../lib/themes";

interface FullShelfProps {
  books: (BookMeta & { progress?: Progress })[];
  query: string;
  onQueryChange: (value: string) => void;
  categories: Category[];
  assignments: Record<string, string[]>;
  categoryCounts: Record<string, number>;
  viewMode: "all" | "categories";
  selectedCategoryId: string;
  onViewModeChange: (mode: "all" | "categories") => void;
  onCategorySelect: (categoryId: string) => void;
  onManageCategories: () => void;
  onAssignCategories: (book: BookMeta) => void;
  onOpen: (book: BookMeta) => void;
  onDelete: (book: BookMeta) => void;
  onChangeCover: (book: BookMeta) => void;
  onImport: () => void;
  onSample: () => void;
  busy: boolean;
  theme: ThemeName;
  onToggleTheme: () => void;
  onOpenMusic: () => void;
  onOpenStats: () => void;
  onOpenLibraryManager: () => void;
  onOpenSettings: () => void;
}

export function FullShelf({
  books,
  query,
  onQueryChange,
  categories,
  assignments,
  categoryCounts,
  viewMode,
  selectedCategoryId,
  onViewModeChange,
  onCategorySelect,
  onManageCategories,
  onAssignCategories,
  onOpen,
  onDelete,
  onChangeCover,
  onImport,
  onSample,
  busy,
  theme,
  onToggleTheme,
  onOpenMusic,
  onOpenStats,
  onOpenLibraryManager,
  onOpenSettings,
}: FullShelfProps) {
  const normalized = query.trim().toLowerCase();
  const uncategorizedCount = books.filter((book) => !(assignments[book.id]?.length)).length;
  let baseBooks = books;
  if (viewMode === "categories") {
    if (selectedCategoryId === "uncategorized") {
      baseBooks = books.filter((book) => !(assignments[book.id]?.length));
    } else if (selectedCategoryId !== "all") {
      baseBooks = books.filter((book) => assignments[book.id]?.includes(selectedCategoryId));
    }
  }
  const filtered = normalized
    ? baseBooks.filter(
        (book) =>
          book.title.toLowerCase().includes(normalized) ||
          book.author.toLowerCase().includes(normalized),
      )
    : baseBooks;

  const themeLabel = getThemeLabel(theme);
  const themeIcon =
    theme === "custom" ? "spark" : themePreset(theme).dark ? "moon" : "sun";

  return (
    <section className="full-shelf">
      <header className="full-shelf__header">
        <div className="full-shelf__brand">
          <div className="brand__seal" aria-hidden="true">
            墨
          </div>
          <div>
            <span className="eyebrow">LIBRARY</span>
            <h1>我的书架</h1>
            <p>{books.length} 本书 · 把世界读慢一点</p>
          </div>
        </div>
        <div className="full-shelf__actions">
          <button className="button button--primary" onClick={onImport} disabled={busy}>
            <Icon name="plus" size={17} />
            导入书籍
          </button>
          <button className="icon-button" onClick={onOpenMusic} title="音乐" aria-label="打开音乐">
            <Icon name="music" size={18} />
          </button>
          <button
            className="icon-button"
            onClick={onOpenStats}
            title="阅读统计"
            aria-label="打开阅读统计"
          >
            <Icon name="chart" size={18} />
          </button>
          <button
            className="icon-button"
            onClick={onOpenLibraryManager}
            title="书库管理"
            aria-label="打开书库管理"
          >
            <Icon name="folder" size={18} />
          </button>
          <button
            className="icon-button"
            onClick={onToggleTheme}
            title={`切换主题（当前：${themeLabel}）`}
            aria-label={`切换主题，当前${themeLabel}`}
          >
            <Icon name={themeIcon} size={18} />
          </button>
          <button
            className="icon-button"
            onClick={onOpenSettings}
            title="软件设置"
            aria-label="软件设置"
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </header>

      <div className="full-shelf__toolbar">
        <label className="search-field full-shelf__search">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索书名或作者"
            aria-label="搜索书架"
          />
          {query ? (
            <button
              type="button"
              className="search-field__clear"
              onClick={() => onQueryChange("")}
              aria-label="清空搜索"
            >
              <Icon name="x" size={13} />
            </button>
          ) : null}
        </label>
        <div className="library-view-tabs">
          <button
            className={viewMode === "all" ? "library-view-tab--active" : ""}
            onClick={() => onViewModeChange("all")}
          >
            全部
          </button>
          <button
            className={viewMode === "categories" ? "library-view-tab--active" : ""}
            onClick={() => onViewModeChange("categories")}
          >
            分类
          </button>
        </div>
        <button
          className="library-manage-button"
          onClick={onManageCategories}
          title="管理分类"
          aria-label="管理分类"
        >
          <Icon name="folder" size={15} />
        </button>
      </div>

      {viewMode === "categories" ? (
        <div className="category-chips full-shelf__chips">
          <button
            className={`category-chip ${selectedCategoryId === "all" ? "category-chip--active" : ""}`}
            onClick={() => onCategorySelect("all")}
          >
            全部 <span>{books.length}</span>
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`category-chip ${selectedCategoryId === category.id ? "category-chip--active" : ""}`}
              onClick={() => onCategorySelect(category.id)}
            >
              {category.name} <span>{categoryCounts[category.id] ?? 0}</span>
            </button>
          ))}
          <button
            className={`category-chip ${selectedCategoryId === "uncategorized" ? "category-chip--active" : ""}`}
            onClick={() => onCategorySelect("uncategorized")}
          >
            未分类 <span>{uncategorizedCount}</span>
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="full-shelf__empty">
          <Icon name="books" size={40} />
          <h2>
            {books.length === 0
              ? "书架还是空的"
              : viewMode === "categories" && selectedCategoryId !== "all"
                ? "这个分类还没有书"
                : "没有找到这本书"}
          </h2>
          <p>
            {books.length === 0
              ? "导入一本 EPUB 或 TXT，开始安静地读一会儿。"
              : "换个关键词，或者切换到「全部」看看。"}
          </p>
          {books.length === 0 ? (
            <div className="full-shelf__empty-actions">
              <button className="button button--primary" onClick={onImport} disabled={busy}>
                <Icon name="plus" size={17} />
                导入书籍
              </button>
              <button className="button button--ghost" onClick={onSample} disabled={busy}>
                读示例书
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="full-shelf__grid">
          {filtered.map((book) => {
            const percent = book.progress?.percent ?? 0;
            return (
              <article
                key={book.id}
                className="shelf-tile"
                role="button"
                tabIndex={0}
                onClick={() => onOpen(book)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(book);
                  }
                }}
              >
                <div className="shelf-tile__cover">
                  <BookCover title={book.title} author={book.author} cover={book.cover} size="large" />
                  <div className="shelf-tile__actions">
                    <button
                      type="button"
                      className="shelf-tile__action"
                      title="加入分类"
                      aria-label={`把《${book.title}》加入分类`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onAssignCategories(book);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Icon name="tag" size={14} />
                    </button>
                    <button
                      type="button"
                      className="shelf-tile__action"
                      title="更换封面"
                      aria-label={`为《${book.title}》更换封面`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onChangeCover(book);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Icon name="image" size={14} />
                    </button>
                    <button
                      type="button"
                      className="shelf-tile__action shelf-tile__action--danger"
                      title="从书架移除"
                      aria-label={`移除《${book.title}》`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(book);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
                <div className="shelf-tile__info">
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <div className="shelf-tile__meta">
                    <span>{book.progress ? percentLabel(percent) : formatBytes(book.size)}</span>
                    <span>
                      {book.format === "txt" ? "TXT" : "EPUB"} · {book.progress ? "已读" : "未读"}
                    </span>
                  </div>
                  <div className="shelf-tile__track" aria-hidden="true">
                    <span style={{ width: `${Math.round(percent * 100)}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
