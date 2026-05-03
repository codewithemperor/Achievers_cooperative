"use client";

import { useState } from "react";
import { Spinner } from "@heroui/react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type ActionTone = "success" | "danger" | "neutral";

interface ConfirmActionButtonProps {
  label: string;
  pendingLabel?: string;
  confirmTitle: string;
  confirmMessage: string;
  onConfirm: () => Promise<void> | void;
  tone?: ActionTone;
  isDisabled?: boolean;
}

const toneClassName: Record<ActionTone, string> = {
  success: "bg-[var(--primary-700)] text-white",
  danger: "bg-[#b42318] text-white",
  neutral: "border border-primary-900/14 bg-white text-text-900",
};

export function ConfirmActionButton({
  label,
  pendingLabel = "Processing...",
  confirmTitle,
  confirmMessage,
  onConfirm,
  tone = "neutral",
  isDisabled = false,
}: ConfirmActionButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    try {
      setPending(true);
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  const [open, setOpen] = useState(false);

  async function handleConfirmAndClose() {
    await handleConfirm();
    setOpen(false);
  }

  return (
    <>
      <button
        className={`rounded-full px-4 py-2 text-sm font-semibold ${toneClassName[tone]} transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60`}
        disabled={isDisabled || pending}
        onClick={() => setOpen(true)}
        type="button"
      >
        {pending ? (
          <>
            <Spinner color="current" size="sm" />
            {pendingLabel}
          </>
        ) : (
          label
        )}
      </button>
      <ConfirmModal
        confirmLabel={pending ? pendingLabel : "Confirm"}
        isOpen={open}
        message={confirmMessage}
        onCancel={() => {
          if (!pending) {
            setOpen(false);
          }
        }}
        onConfirm={() => void handleConfirmAndClose()}
        title={confirmTitle}
      />
    </>
  );
}
