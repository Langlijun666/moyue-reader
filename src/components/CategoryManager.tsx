import { useEffect, useState } from "react";
import type { Category } from "../lib/categories";
import { Icon } from "./Icons";

interface CategoryManagerProps {
  open: boolean;
  categories: Category[];
  counts: Record<string, number>;
  onClose: () => void;
  onCreate: (name: string) => boolean;
  onDelete: (category: Category) => void;
}

export function CategoryManager({
  open,
  categories,
  counts,
  onClose,
  onCreate,
  onDelete,
}: CategoryManagerProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

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

  if (!open) return null;

  const submit = () => {
    const value = name.trim();
    if (!value) {
      setError("请输入分类名称");
      return;
    }
    if (!onCreate(value)) {
      setError("这个分类已经存在了");
      return;
    }
    setName("");
    setError(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="category-dialog"
        role="dialog"
        aria-label="管理分类"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="category-dialog__header">
          <div>
            <span className="eyebrow">LIBRARY</span>
            <h3>管理分类</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭分类管理">
            <Icon name="x" size={18} />
          </button>
        </header>

        <form
          className="category-create"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="新建分类，例如：恐怖小说"
            maxLength={24}
            aria-label="分类名称"
          />
          <button className="button button--primary" type="submit">
            <Icon name="plus" size={16} />
            创建
          </button>
        </form>
        {error ? <p className="category-error">{error}</p> : null}

        <div className="category-manager-list">
          {categories.length === 0 ? (
            <div className="category-empty">
              <Icon name="folder" size={28} />
              <p>还没有分类。创建后可以把书架里的书放进去。</p>
            </div>
          ) : (
            categories.map((category) => (
              <div className="category-manager-row" key={category.id}>
                <span className="category-manager-row__icon">
                  <Icon name="folder" size={15} />
                </span>
                <span className="category-manager-row__name">{category.name}</span>
                <span className="category-manager-row__count">
                  {counts[category.id] ?? 0} 本
                </span>
                <button
                  className="category-manager-row__delete"
                  onClick={() => onDelete(category)}
                  aria-label={`删除分类 ${category.name}`}
                  title="删除分类"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
