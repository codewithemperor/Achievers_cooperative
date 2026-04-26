"use client";

import type { PropsWithChildren, ReactNode } from "react";

interface MemberModalProps extends PropsWithChildren {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
}

export function MemberModal({ isOpen, onClose, title, description, children, footer }: MemberModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,24,16,0.42)] p-4 backdrop-blur-sm">
      <button aria-label="Close modal" className="absolute inset-0" onClick={onClose} type="button" />
      <div className="relative z-10 w-full max-w-lg rounded-[1.75rem] border border-[var(--brand-stroke)] bg-[var(--brand-surface)] shadow-[0_24px_80px_rgba(23,50,30,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--brand-stroke)] px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--brand-ink)]">{title}</h2>
            {description ? <p className="mt-1 text-sm text-[var(--brand-moss)]">{description}</p> : null}
          </div>
          <button
            className="rounded-full border border-[var(--brand-stroke)] bg-white px-3 py-1 text-sm font-medium text-[var(--brand-ink)]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-[var(--brand-stroke)] px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
