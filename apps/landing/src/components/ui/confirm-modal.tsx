"use client";

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
}

export function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = "Confirm",
}: ConfirmModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4">
      <div className="w-full max-w-md rounded-[1.5rem] bg-white p-4 shadow-2xl sm:p-5">
        <h3 className="text-xl font-semibold text-[var(--text-900)]">{title}</h3>
        <p className="mt-3 text-sm text-[var(--text-400)]">{message}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            className="rounded-full border border-primary-900/14 px-4 py-2 text-sm font-medium text-[var(--text-900)]"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-[var(--primary-700)] px-4 py-2 text-sm font-medium text-white"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
