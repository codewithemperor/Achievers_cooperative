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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-950/42 p-4 backdrop-blur-sm">
      <button aria-label="Close modal" className="absolute inset-0" onClick={onClose} type="button" />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-background-200 bg-white shadow-xl dark:border-background-700 dark:bg-background-800">
        <div className="flex items-start justify-between gap-4 border-b border-background-200 px-5 py-4 dark:border-background-700">
          <div>
            <h2 className="font-display text-xl font-semibold text-text-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-text-400">{description}</p> : null}
          </div>
          <button
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-background-200 bg-white text-sm font-medium text-text-700 transition-colors hover:bg-background-100 dark:border-background-700 dark:bg-background-800 dark:text-text-300"
            onClick={onClose}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-background-200 px-5 py-4 dark:border-background-700">{footer}</div> : null}
      </div>
    </div>
  );
}
