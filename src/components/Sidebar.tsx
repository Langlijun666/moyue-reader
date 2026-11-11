import type { BookMeta, Progress, ReaderSettings } from "../types";
import type { Category } from "../lib/categories";
import { formatBytes, percentLabel } from "../lib/format";
import { BookCover } from "./BookCover";
import { Icon } from "./Icons";

interface LibraryBook extends BookMeta {
  progress?: Progress;
}

interface SidebarProps {
  books: LibraryBook[];
  activeId?: string;
  query: string;
  settings: ReaderSettings;
  busy: boolean;
  hidden?: boolean;
  onQueryChange: (value: string) => void;
  onImport: () => void;
  onOpen: (book: BookMeta) => void;
  onDelete: (book: BookMeta) => void;
  onChangeCover: (book: BookMeta) => void;
  onSample: () => void;
  onToggleTheme: () => void;
  onOpenMusic: () => void;
  categories: Category[];
  assignments: Record<string, string[]>;
  categoryCounts: Record<string, number>;
  viewMode: "all" | "categories";
  selectedCategoryId: string;
  onViewModeChange: (mode: "all" | "categories") => void;
  onCategorySelect: (categoryId: string) => void;
  onManageCategories: () => void;
  onAssignCategories: (book: BookMeta) => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  books,
  activeId,
  query,
  settings,
  busy,
  hidden = false,
  onQueryChange,
  onImport,
  onOpen,
  onDelete,
  onChangeCover,
  onSample,
  onToggleTheme,
  onOpenMusic,
  categories,
  assignments,
  categoryCounts,
  viewMode,
  selectedCategoryId,
  onViewModeChange,
  onCategorySelect,
  onManageCategories,
  onAssignCategories,
  onOpenStats,
  onOpenSettings,
}: SidebarProps) {
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

  const themeLabel =
    settings.theme === "night"
      ? "夜墨"
      : settings.theme === "sepia"
        ? "茶褐"
        : settings.theme === "custom"
          ? "自定义"
          : "纸白";
  const themeIcon =
    settings.theme === "night"
      ? "moon"
      : settings.theme === "sepia"
        ? "book"
        : settings.theme === "custom"
          ? "spark"
          : "sun";

  return (
    <aside
      className="sidebar"
      aria-hidden={hidden}
      inert={hidden ? true : undefined}
    >
      <header className="brand">
        <div className="brand__seal" aria-hidden="true">
          墨
        </div>
        <div className="brand__text">
          <h1>墨阅</h1>
          <p>把世界读慢一点</p>
        </div>
      </header>

      <div className="sidebar__actions">
        <button className="button button--primary" onClick={onImport} disabled={busy}>
          <Icon name="plus" size={17} />
          <span>导入书籍</span>
        </button>
        <button
          className="button button--ghost button--icon"
          onClick={onToggleTheme}
          title={`切换主题（当前：${themeLabel}）`}
          aria-label={`切换主题，当前${themeLabel}`}
        >
          <Icon name={themeIcon} size={18} />
        </button>
      </div>

      <label className="search-field">
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

      <div className="library-view-row">
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
        <div className="category-chips">
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

      <div className="library-heading">
        <span>我的书架</span>
        <span className="library-heading__count">{books.length}</span>
      </div>

      <div className="book-list">
        {filtered.length === 0 ? (
          <div className="book-list__empty">
            <Icon name="books" size={28} />
            <p>
              {books.length === 0
                ? "书架还是空的"
                : viewMode === "categories" && selectedCategoryId !== "all"
                  ? "这个分类还没有书"
                  : "没有找到这本书"}
            </p>
            {books.length === 0 ? (
              <button className="text-button" onClick={onSample} disabled={busy}>
                先读一本示例书
              </button>
            ) : null}
          </div>
        ) : (
          filtered.map((book) => {
            const percent = book.progress?.percent ?? 0;
            return (
              <div
                key={book.id}
                className={`book-card ${activeId === book.id ? "book-card--active" : ""}`}
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
                <div className="book-card__cover">
                  <BookCover title={book.title} author={book.author} cover={book.cover} />
                  <button
                    type="button"
                    className="book-card__cover-edit"
                    title="更换封面"
                    aria-label={`为《${book.title}》更换封面`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChangeCover(book);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Icon name="image" size={12} />
                  </button>
                </div>
                <div className="book-card__info">
                  <div className="book-card__title">{book.title}</div>
                  <div className="book-card__author">{book.author}</div>
                  <div className="book-card__meta">
                    <span>{book.progress ? percentLabel(percent) : formatBytes(book.size)}</span>
                    <span>
                      {book.format === "txt" ? "TXT" : "EPUB"} · {book.progress ? "已读" : "未读"}
                    </span>
                  </div>
                  <div className="book-card__track" aria-hidden="true">
                    <span style={{ width: `${Math.round(percent * 100)}%` }} />
                  </div>
                </div>
                <div className="book-card__actions">
                  <button
                    type="button"
                    className="book-card__tag"
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
                    className="book-card__delete"
                    title="从书架移除"
                    aria-label={`移除《${book.title}》`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(book);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <footer className="sidebar__footer">
        <div className="sidebar__footer-actions">
          <button className="theme-chip" onClick={onToggleTheme}>
            <Icon
              name={
                settings.theme === "night"
                  ? "moon"
                  : settings.theme === "sepia"
                    ? "book"
                    : settings.theme === "custom"
                      ? "spark"
                      : "coffee"
              }
              size={15}
            />
            <span>
              {settings.theme === "night"
                ? "夜间模式"
                : settings.theme === "sepia"
                  ? "茶褐书页"
                  : settings.theme === "custom"
                    ? "自定义纸张"
                    : "纸感阅读"}
            </span>
          </button>
          <button className="theme-chip" onClick={onOpenMusic}>
            <Icon name="music" size={15} />
            <span>听歌</span>
          </button>
          <button className="theme-chip" onClick={onOpenStats} title="阅读统计" aria-label="阅读统计">
            <Icon name="chart" size={15} />
            <span>统计</span>
          </button>
          <button
            className="theme-chip theme-chip--icon"
            onClick={onOpenSettings}
            title="软件设置"
            aria-label="软件设置"
          >
            <Icon name="settings" size={15} />
          </button>
        </div>
        <span className="sidebar__hint">本地保存 · 离线可读</span>
      </footer>
    </aside>
  );
}
