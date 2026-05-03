"use client";

import type { PropsWithChildren } from "react";

interface DetailDrawerProps extends PropsWithChildren {
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function DetailDrawer({
  isOpen,
  onClose,
  title,
  children,
}: DetailDrawerProps) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <div
        className={`absolute inset-0 bg-[rgba(0,0,0,0.38)] transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-xl transform bg-[var(--background-50)] p-6 shadow-2xl transition-transform ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-primary-900/12 pb-4">
          <h3 className="text-xl font-semibold text-text-900">{title}</h3>
          <button
            className="rounded-full border border-primary-900/14 px-3 py-1 text-sm text-text-900"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="mt-5 max-h-[calc(100vh-6rem)] overflow-y-auto">
          {children}
        </div>
      </aside>
    </div>
  );
}
