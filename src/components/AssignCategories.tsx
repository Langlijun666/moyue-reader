import { useEffect } from "react";
import type { Category } from "../lib/categories";
import type { BookMeta } from "../types";
import { Icon } from "./Icons";

interface AssignCategoriesProps {
  open: boolean;
  book: BookMeta | null;
  categories: Category[];
  assignedIds: string[];
  onToggle: (categoryId: string) => void;
  onClose: () => void;
  onManage: () => void;
}

export function AssignCategories({
  open,
  book,
  categories,
  assignedIds,
  onToggle,
  onClose,
  onManage,
}: AssignCategoriesProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      event.stopPropagation();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, onClose]);

  if (!open || !book) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="category-dialog category-dialog--assign"
        role="dialog"
        aria-label="把书加入分类"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="category-dialog__header">
          <div>
            <span className="eyebrow">SHELF</span>
            <h3>把书加入分类</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭分类选择">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="assign-book">
          <Icon name="book" size={17} />
          <div>
            <strong>{book.title}</strong>
            <small>{book.author}</small>
          </div>
        </div>

        <div className="assign-list">
          {categories.length === 0 ? (
            <div className="category-empty">
              <Icon name="folder" size={28} />
              <p>还没有分类，先创建一个分类吧。</p>
              <button
                className="button button--primary"
                onClick={() => {
                  onClose();
                  onManage();
                }}
              >
                <Icon name="plus" size={16} />
                去创建分类
              </button>
            </div>
          ) : (
            categories.map((category) => {
              const checked = assignedIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  className={`assign-row ${checked ? "assign-row--checked" : ""}`}
                  onClick={() => onToggle(category.id)}
                >
                  <span className="assign-row__check">
                    {checked ? <Icon name="check" size={12} /> : null}
                  </span>
                  <Icon name="folder" size={15} />
                  <span className="assign-row__name">{category.name}</span>
                </button>
              );
            })
          )}
        </div>

        <footer className="category-dialog__footer">
          <button className="text-button" onClick={onManage}>
            管理分类
          </button>
          <button className="button button--primary" onClick={onClose}>
            完成
          </button>
        </footer>
      </section>
    </div>
  );
}
