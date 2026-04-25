"use client";

import { useState } from "react";
import { AlertDialog, Button, Spinner } from "@heroui/react";

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
  success: "bg-[var(--color-green)] text-white",
  danger: "bg-[#b42318] text-white",
  neutral: "border border-[rgba(26,46,26,0.14)] bg-white text-[var(--color-dark)]",
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

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <div>
          <Button
            className={`rounded-full px-4 py-2 text-sm font-semibold ${toneClassName[tone]}`}
            isDisabled={isDisabled || pending}
          >
            {pending ? (
              <>
                <Spinner color="current" size="sm" />
                {pendingLabel}
              </>
            ) : (
              label
            )}
          </Button>
        </div>
      </AlertDialog.Trigger>
      <AlertDialog.Backdrop className="bg-[rgba(26,46,26,0.45)] backdrop-blur-sm">
        <AlertDialog.Container className="w-full max-w-lg px-4" placement="center">
          <AlertDialog.Dialog className="rounded-[2rem] bg-white shadow-[0_24px_60px_rgba(26,46,26,0.16)]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header className="px-6 pt-6">
              <AlertDialog.Heading className="text-xl font-semibold text-[var(--color-dark)]">
                {confirmTitle}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="px-6 py-4 text-sm text-[var(--color-coop-muted)]">
              {confirmMessage}
            </AlertDialog.Body>
            <AlertDialog.Footer className="flex justify-end gap-3 px-6 pb-6">
              <Button className="rounded-full border border-[rgba(26,46,26,0.12)] px-4 py-2 text-sm font-medium text-[var(--color-dark)]" slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${toneClassName[tone]}`}
                onPress={handleConfirm}
                slot="close"
              >
                Confirm
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog.Root>
  );
}
