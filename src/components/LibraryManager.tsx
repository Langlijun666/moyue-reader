import { useEffect, useMemo, useRef, useState } from "react";
import type { BookMeta, LibrarySort } from "../types";
import type { Category } from "../lib/categories";
import { formatBytes } from "../lib/format";
import { Icon } from "./Icons";

interface LibraryManagerProps {
  open: boolean;
  books: BookMeta[];
  deletedBooks: BookMeta[];
  categories: Category[];
  assignments: Record<string, string[]>;
  sortBy: LibrarySort;
  watchedFolder: string;
  watchStatus: string;
  onSortChange: (sort: LibrarySort) => void;
  onClose: () => void;
  onImport: (files: FileList) => void;
  onPickFolder: () => void;
  onStopWatch: () => void;
  onAssignCategories: (ids: string[], categoryIds: string[], mode: "add" | "remove") => void;
  onSetSeries: (ids: string[], series: string) => void;
  onDelete: (ids: string[]) => void;
  onSetCover: (ids: string[], file: File) => void;
  onRestore: (ids: string[]) => void;
  onPurge: (ids: string[]) => void;
  onEmptyTrash: () => void;
}

function duplicateKeys(books: BookMeta[]): Map<string, BookMeta[]> {
  const groups = new Map<string, BookMeta[]>();
  for (const book of books) {
    const key = `${book.title.trim().toLowerCase()}|${book.author.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), book]);
  }
  return new Map([...groups].filter(([, list]) => list.length > 1));
}

export function LibraryManager({
  open,
  books,
  deletedBooks,
  categories,
  assignments,
  sortBy,
  watchedFolder,
  watchStatus,
  onSortChange,
  onClose,
  onImport,
  onPickFolder,
  onStopWatch,
  onAssignCategories,
  onSetSeries,
  onDelete,
  onSetCover,
  onRestore,
  onPurge,
  onEmptyTrash,
}: LibraryManagerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [series, setSeries] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const duplicateMap = useMemo(() => duplicateKeys(books), [books]);
  const duplicates = useMemo(
    () => new Set([...duplicateMap.values()].flatMap((list) => list.slice(1).map((b) => b.id))),
    [duplicateMap],
  );
  const totalBytes = books.reduce((sum, book) => sum + book.size, 0);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setCategoryIds([]);
      setSeries("");
      setShowTrash(false);
    }
  }, [open]);

  if (!open) return null;

  const ids = [...selected];
  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = books.length > 0 && selected.size === books.length;

  return (
    <div className="library-manager-backdrop" onClick={onClose}>
      <section
        className="library-manager"
        role="dialog"
        aria-label="书库管理"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="library-manager__header">
          <div>
            <span className="eyebrow">LIBRARY</span>
            <h3>书库管理</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭书库管理">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="library-manager__summary">
          <span>{books.length} 本书</span>
          <span>占用 {formatBytes(totalBytes)}</span>
          <span>{duplicateMap.size} 组疑似重复</span>
        </div>

        <div className="library-manager__toolbar">
          <button className="button button--primary" onClick={() => importRef.current?.click()}>
            <Icon name="plus" size={14} />
            批量导入
          </button>
          <button className="button button--ghost" onClick={onPickFolder}>
            <Icon name="folder" size={14} />
            选择监视文件夹
          </button>
          <button className="button button--ghost" onClick={() => setShowTrash((value) => !value)}>
            回收站（{deletedBooks.length}）
          </button>
          <select
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as LibrarySort)}
            aria-label="书库排序"
          >
            <option value="recent">最近阅读</option>
            <option value="author">按作者</option>
            <option value="series">按系列</option>
            <option value="added">按导入时间</option>
          </select>
          <input
            ref={importRef}
            type="file"
            multiple
            accept=".epub,.txt,.pdf"
            className="hidden-file-input"
            onChange={(event) => {
              if (event.target.files) onImport(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={coverRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && ids.length > 0) onSetCover(ids, file);
              event.target.value = "";
            }}
          />
        </div>

        {watchedFolder ? (
          <div className="library-watch">
            <Icon name="refresh" size={13} />
            <span title={watchedFolder}>
              监视中：{watchedFolder}
              {watchStatus ? ` · ${watchStatus}` : ""}
            </span>
            <button className="text-button" onClick={onStopWatch}>停止</button>
          </div>
        ) : null}

        {!showTrash ? (
          <>
        <div className="library-manager__batch">
          <label className="library-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? new Set() : new Set(books.map((book) => book.id)))
              }
            />
            全选
            <span>{selected.size} 本</span>
          </label>
          <select
            multiple
            value={categoryIds}
            onChange={(event) =>
              setCategoryIds(Array.from(event.target.selectedOptions, (option) => option.value))
            }
            aria-label="批量分类"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button
            className="button button--ghost"
            disabled={ids.length === 0 || categoryIds.length === 0}
            onClick={() => onAssignCategories(ids, categoryIds, "add")}
          >
            添加分类
          </button>
          <button
            className="button button--ghost"
            disabled={ids.length === 0 || categoryIds.length === 0}
            onClick={() => onAssignCategories(ids, categoryIds, "remove")}
          >
            移除分类
          </button>
          <input
            value={series}
            placeholder="系列 / 丛书名"
            onChange={(event) => setSeries(event.target.value)}
          />
          <button
            className="button button--ghost"
            disabled={ids.length === 0 || !series.trim()}
            onClick={() => onSetSeries(ids, series.trim())}
          >
            设置系列
          </button>
          <button
            className="button button--ghost"
            disabled={ids.length === 0}
            onClick={() => coverRef.current?.click()}
          >
            批量改封面
          </button>
          <button
            className="button button--ghost"
            disabled={ids.length === 0}
            onClick={() => onDelete(ids)}
          >
            批量删除
          </button>
          {duplicates.size > 0 ? (
            <button
              className="button button--ghost"
              onClick={() => setSelected(new Set(duplicates))}
            >
              选中重复项（{duplicates.size}）
            </button>
          ) : null}
        </div>

        <div className="library-manager__list">
          {books.map((book) => {
            const selectedBook = selected.has(book.id);
            return (
              <label
                key={book.id}
                className={`library-manager-row ${selectedBook ? "library-manager-row--active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedBook}
                  onChange={() => toggle(book.id)}
                />
                <span className="library-manager-row__title">{book.title}</span>
                <span className="library-manager-row__meta">{book.author}</span>
                <span className="library-manager-row__meta">
                  {book.series || "未分组"}
                </span>
                <span className="library-manager-row__meta">{formatBytes(book.size)}</span>
                <span className="library-manager-row__meta">
                  {new Date(book.addedAt).toLocaleDateString("zh-CN")}
                </span>
                {duplicates.has(book.id) ? <span className="library-duplicate">重复</span> : null}
                <span className="library-manager-row__categories">
                  {(assignments[book.id] ?? []).length} 个分类
                </span>
              </label>
            );
          })}
        </div>
          </>
        ) : (
          <div className="library-manager__list library-trash-list">
            <div className="library-trash-head">
              <span>回收站 · 保留 30 天</span>
              {deletedBooks.length > 0 ? (
                <button className="text-button" onClick={onEmptyTrash}>清空回收站</button>
              ) : null}
            </div>
            {deletedBooks.length === 0 ? (
              <p className="library-trash-empty">回收站是空的。</p>
            ) : (
              deletedBooks.map((book) => (
                <div className="library-manager-row library-manager-row--trash" key={book.id}>
                  <span className="library-manager-row__title">{book.title}</span>
                  <span className="library-manager-row__meta">{book.author}</span>
                  <span className="library-manager-row__meta">
                    {new Date(book.deletedAt ?? Date.now()).toLocaleDateString("zh-CN")} 删除
                  </span>
                  <span className="library-manager-row__meta">{formatBytes(book.size)}</span>
                  <button className="button button--ghost" onClick={() => onRestore([book.id])}>
                    恢复
                  </button>
                  <button className="button button--ghost" onClick={() => onPurge([book.id])}>
                    彻底删除
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
