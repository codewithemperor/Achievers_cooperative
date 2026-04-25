"use client";

import type { ReactNode } from "react";
import { Modal } from "@heroui/react";

interface AdminModalProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AdminModal({ trigger, title, description, children, footer }: AdminModalProps) {
  return (
    <Modal.Root>
      <Modal.Trigger>{trigger}</Modal.Trigger>
      <Modal.Backdrop className="bg-[rgba(26,46,26,0.45)] backdrop-blur-sm">
        <Modal.Container className="w-full max-w-3xl px-4" placement="center">
          <Modal.Dialog className="rounded-[2rem] border border-[rgba(26,46,26,0.08)] bg-white shadow-[0_24px_60px_rgba(26,46,26,0.12)]">
            <Modal.Header className="flex items-start justify-between gap-4 border-b border-[rgba(26,46,26,0.08)] px-6 py-5">
              <div>
                <Modal.Heading className="text-2xl font-semibold text-[var(--color-dark)]">{title}</Modal.Heading>
                {description ? <p className="mt-2 text-sm text-[var(--color-coop-muted)]">{description}</p> : null}
              </div>
              <Modal.CloseTrigger className="rounded-full border border-[rgba(26,46,26,0.12)] px-3 py-1 text-sm text-[var(--color-dark)]">
                Close
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body className="px-6 py-6">{children}</Modal.Body>
            {footer ? <Modal.Footer className="border-t border-[rgba(26,46,26,0.08)] px-6 py-5">{footer}</Modal.Footer> : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
