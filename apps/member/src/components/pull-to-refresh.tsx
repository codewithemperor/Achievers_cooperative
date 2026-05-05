"use client";

import type { ReactNode } from "react";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  className,
}: PullToRefreshProps) {
  return (
    <div
      className={className}
      onTouchEnd={() => {
        if (typeof window !== "undefined" && window.scrollY <= 0) {
          void onRefresh();
        }
      }}
    >
      {children}
    </div>
  );
}
