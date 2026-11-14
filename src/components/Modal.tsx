import type { ReactNode } from "react";

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
  if (!open) return null;
  return (
    <div className={`modal-layer ${layerClassName}`} onMouseDown={onClose}>
      <section
        className={className}
        role="dialog"
        aria-label={ariaLabel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}
