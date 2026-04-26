"use client";

import { cloneElement, isValidElement, useState, type ReactNode } from "react";
import { Modal } from "@heroui/react";

interface AdminModalProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode | ((controls: { close: () => void }) => ReactNode);
  footer?: ReactNode;
}

export function AdminModal({ trigger, title, description, children, footer }: AdminModalProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const triggerElement = isValidElement(trigger) ? (trigger as React.ReactElement<any>) : null;
  const triggerNode = isValidElement(trigger)
    ? cloneElement(triggerElement!, {
        onClick: (event: any) => {
          triggerElement?.props?.onClick?.(event);
          setOpen(true);
        },
      })
    : <span onClick={() => setOpen(true)}>{trigger}</span>;

  return (
    <>
      {triggerNode}
      {open ? (
        <Modal.Root>
          <Modal.Backdrop className="bg-[rgba(26,46,26,0.45)] backdrop-blur-sm">
            <Modal.Container className="w-full max-w-3xl px-4" placement="center">
              <Modal.Dialog className="rounded-[1.75rem] border border-[rgba(26,46,26,0.08)] bg-white shadow-[0_24px_60px_rgba(26,46,26,0.12)]">
                <Modal.Header className="flex items-start justify-between gap-4 border-b border-[rgba(26,46,26,0.08)] px-5 py-4 sm:px-6">
                  <div>
                    <Modal.Heading className="text-2xl font-semibold text-[var(--color-dark)]">{title}</Modal.Heading>
                    {description ? <p className="mt-2 text-sm text-[var(--color-coop-muted)]">{description}</p> : null}
                  </div>
                  <button className="rounded-full border border-[rgba(26,46,26,0.12)] px-3 py-1 text-sm text-[var(--color-dark)]" onClick={close} type="button">
                    Close
                  </button>
                </Modal.Header>
                <Modal.Body className="px-5 py-4 sm:px-6 sm:py-5">{typeof children === "function" ? children({ close }) : children}</Modal.Body>
                {footer ? <Modal.Footer className="border-t border-[rgba(26,46,26,0.08)] px-5 py-4 sm:px-6">{footer}</Modal.Footer> : null}
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal.Root>
      ) : null}
    </>
  );
}
