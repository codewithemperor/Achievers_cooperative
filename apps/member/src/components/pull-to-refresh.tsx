"use client";

import { useRef } from "react";
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
  const touchStart = useRef<{
    x: number;
    y: number;
    scrollY: number;
  } | null>(null);
  const shouldRefresh = useRef(false);

  return (
    <div
      className={className}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = {
          x: touch.clientX,
          y: touch.clientY,
          scrollY: window.scrollY,
        };
        shouldRefresh.current = false;
      }}
      onTouchMove={(event) => {
        const start = touchStart.current;
        const touch = event.touches[0];
        if (!start || !touch) return;

        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);

        shouldRefresh.current =
          start.scrollY <= 0 &&
          deltaY > 72 &&
          !isHorizontalSwipe &&
          Math.abs(deltaY) > Math.abs(deltaX) * 1.35;
      }}
      onTouchEnd={() => {
        if (shouldRefresh.current) {
          void onRefresh();
        }
        touchStart.current = null;
        shouldRefresh.current = false;
      }}
      onTouchCancel={() => {
        touchStart.current = null;
        shouldRefresh.current = false;
      }}
    >
      {children}
    </div>
  );
}
