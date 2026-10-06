import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "./ModalPortal";

type ConfirmDeleteModalProps = {
  open: boolean;
  title: string;
  itemName?: string;
  description?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  open,
  title,
  itemName,
  description,
  confirmLabel = "Hapus",
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  if (!open) return null;

  return (
    <ModalPortal onClose={onCancel} blocked={busy}>
      <section
        className="participant-modal delete-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="participant-modal__header">
          <div>
            <p className="section-label">Konfirmasi</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="participant-modal__close"
            aria-label="Tutup konfirmasi"
            disabled={busy}
            onClick={onCancel}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="participant-modal__body" id={descriptionId}>
          {itemName && <p className="confirm-delete-modal__item">“<strong>{itemName}</strong>”</p>}
          {description && <div className="confirm-delete-modal__description">{description}</div>}
        </div>

        <footer className="participant-modal__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={onCancel}
          >
            Batal
          </button>
          <button
            type="button"
            className="button danger-button confirm-delete-modal__confirm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Menghapus…" : confirmLabel}
          </button>
        </footer>
      </section>
    </ModalPortal>
  );
}
