import { useEffect, useRef, useState } from "react";
import {
  HIGHLIGHT_COLORS,
  type HighlightColor,
} from "../lib/highlights";
import { Icon } from "./Icons";

interface SelectionToolbarProps {
  left: number;
  top: number;
  onHighlight: (color: HighlightColor, note: string) => void;
  onClose: () => void;
}

export function SelectionToolbar({
  left,
  top,
  onHighlight,
  onClose,
}: SelectionToolbarProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNoteOpen(false);
    setNote("");
  }, [left, top]);

  useEffect(() => {
    if (noteOpen) noteRef.current?.focus();
  }, [noteOpen]);

  return (
    <>
      <div className="selection-toolbar__backdrop" onMouseDown={onClose} />
      <div
        className="selection-toolbar"
        style={{ left, top }}
        role="toolbar"
        aria-label="划线工具"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).tagName !== "TEXTAREA") {
            event.preventDefault();
          }
        }}
      >
        <div className="selection-toolbar__row">
          <span className="selection-toolbar__label">划线</span>
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.id}
              className={`selection-color selection-color--${color.id}`}
              title={color.label}
              aria-label={color.label}
              onClick={() => onHighlight(color.id, "")}
            />
          ))}
          <span className="selection-toolbar__divider" />
          <button
            className={
              noteOpen
                ? "selection-toolbar__action selection-toolbar__action--active"
                : "selection-toolbar__action"
            }
            onClick={() => setNoteOpen((value) => !value)}
            title="添加笔记"
          >
            <Icon name="pen" size={13} />
            笔记
          </button>
        </div>
        {noteOpen ? (
          <div className="selection-toolbar__note">
            <textarea
              ref={noteRef}
              value={note}
              maxLength={500}
              placeholder="写点想法…"
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  onHighlight("gold", note.trim());
                }
              }}
            />
            <div className="selection-toolbar__note-actions">
              <button onClick={onClose}>取消</button>
              <button
                className="selection-toolbar__save"
                onClick={() => onHighlight("gold", note.trim())}
              >
                保存
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
