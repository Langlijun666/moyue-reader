import type { BookMeta } from "../types";
import { Modal } from "./Modal";

interface VolumePickerProps {
  open: boolean;
  title: string;
  books: BookMeta[];
  onOpen: (book: BookMeta) => void;
  onClose: () => void;
}

export function VolumePicker({ open, title, books, onOpen, onClose }: VolumePickerProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel={`${title} 分卷`}
      className="volume-picker"
      layerClassName="modal-backdrop"
    >
      <header className="volume-picker__head">
        <div>
          <span className="eyebrow">VOLUMES</span>
          <h3>{title}</h3>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="关闭分卷">
          ×
        </button>
      </header>
      <div className="volume-picker__list">
        {books.map((book, index) => (
          <button key={book.id} className="volume-picker__item" onClick={() => onOpen(book)}>
            <span className="volume-picker__number">{String(index + 1).padStart(2, "0")}</span>
            <span className="volume-picker__title">{book.title}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
