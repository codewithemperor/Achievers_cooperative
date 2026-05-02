"use client";

import { cloneElement, isValidElement, useEffect, useState, type ReactElement, type ReactNode } from "react";

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
  const triggerElement = isValidElement(trigger) ? (trigger as ReactElement<any>) : null;
  const triggerNode = isValidElement(trigger)
    ? cloneElement(triggerElement!, {
        onClick: (event: any) => {
          triggerElement?.props?.onClick?.(event);
          setOpen(true);
        },
      })
    : <span onClick={() => setOpen(true)}>{trigger}</span>;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <>
      {triggerNode}
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.45)] p-4 backdrop-blur-sm">
          <button
            aria-label="Close dialog"
            className="absolute inset-0"
            onClick={close}
            type="button"
          />
          <div
            aria-modal="true"
            className="relative z-[101] max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-primary-900/8 bg-white shadow-[0_24px_60px_var(--primary-900)/12] dark:border-[var(--background-700)] dark:bg-[var(--background-900)]"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-primary-900/8 px-5 py-4 sm:px-6 dark:border-[var(--background-700)]">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-900)] dark:text-[var(--text-50)]">{title}</h2>
                {description ? <p className="mt-2 text-sm text-[var(--text-400)]">{description}</p> : null}
              </div>
              <button
                className="rounded-full border border-primary-900/12 px-3 py-1 text-sm text-[var(--text-900)] dark:border-[var(--background-700)] dark:text-[var(--text-100)]"
                onClick={close}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 sm:px-6 sm:py-5">{typeof children === "function" ? children({ close }) : children}</div>
            {footer ? <div className="border-t border-primary-900/8 px-5 py-4 sm:px-6 dark:border-[var(--background-700)]">{footer}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
