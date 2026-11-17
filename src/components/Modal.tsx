import { useRef, type ReactNode, type TouchEvent } from "react";
import { IS_ANDROID } from "../lib/platform";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  layerClassName?: string;
  className?: string;
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  ariaLabel,
  layerClassName = "modal-backdrop",
  className,
  children,
}: ModalProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef({ active: false, startY: 0, dy: 0 });

  if (!open) return null;

  const finishDrag = (close: boolean) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = "transform 200ms ease, opacity 200ms ease";
    if (close) {
      sheet.style.transform = "translateY(100%)";
      sheet.style.opacity = "0";
      window.setTimeout(onClose, 190);
    } else {
      sheet.style.transform = "translateY(0)";
      sheet.style.opacity = "1";
    }
  };

  const startDrag = (event: TouchEvent<HTMLDivElement>) => {
    if (!IS_ANDROID) return;
    const touch = event.touches[0];
    if (!touch || !sheetRef.current) return;
    dragRef.current = { active: true, startY: touch.clientY, dy: 0 };
    sheetRef.current.style.transition = "none";
    sheetRef.current.style.animation = "none";
  };

  const moveDrag = (event: TouchEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const touch = event.touches[0];
    if (!touch) return;
    drag.dy = Math.max(0, touch.clientY - drag.startY);
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${drag.dy}px)`;
    }
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    finishDrag(drag.dy > 90);
  };

  return (
    <div className={`modal-layer ${layerClassName}`} onMouseDown={onClose}>
      <section
        ref={sheetRef}
        className={className}
        role="dialog"
        aria-label={ariaLabel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className="modal-grip"
          aria-hidden="true"
          onTouchStart={startDrag}
          onTouchMove={moveDrag}
          onTouchEnd={endDrag}
          onTouchCancel={() => {
            dragRef.current.active = false;
            finishDrag(false);
          }}
        />
        {children}
      </section>
    </div>
  );
}
