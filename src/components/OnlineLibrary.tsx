import { useState } from "react";
import { Icon } from "./Icons";
import { GutenbergStore } from "./GutenbergStore";
import { BookStore } from "./BookStore";

interface OnlineLibraryProps {
  open: boolean;
  onClose: () => void;
  onImport: (file: File, open?: boolean, coverUrl?: string) => Promise<void>;
}

type StoreSource = "online" | "gutenberg";

const SOURCES: { id: StoreSource; label: string }[] = [
  { id: "online", label: "线上书城" },
  { id: "gutenberg", label: "公版书" },
];

export function OnlineLibrary({ open, onClose, onImport }: OnlineLibraryProps) {
  const [source, setSource] = useState<StoreSource>("online");

  if (!open) return null;

  return (
    <section className="online-store" role="dialog" aria-label="书城">
      <header className="online-store__head">
        <div className="store-source" role="tablist" aria-label="书城来源">
          {SOURCES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={source === item.id}
              className={source === item.id ? "is-active" : ""}
              onClick={() => setSource(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="返回书架">
          <Icon name="x" size={18} />
        </button>
      </header>

      {source === "online" ? (
        <BookStore onImport={onImport} />
      ) : (
        <GutenbergStore onImport={onImport} />
      )}
    </section>
  );
}
