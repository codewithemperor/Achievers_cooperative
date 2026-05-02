import type { CSSProperties } from "react";
import clsx from "clsx";

function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-primary-900/7",
        className,
      )}
      style={style}
    />
  );
}

export function SkeletonStatCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-primary-900/8 bg-white p-5"
        >
          <Bone className="mb-4 h-3 w-24" />
          <Bone className="mb-2 h-7 w-32" />
          <Bone className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 border-b border-primary-900/6 pb-2">
        {[40, 28, 20, 12].map((w, i) => (
          <Bone
            key={i}
            className="h-3"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          {[40, 28, 20, 12].map((w, j) => (
            <Bone
              key={j}
              className="h-3"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-background-50/72 p-4">
          <div className="flex items-center justify-between">
            <Bone className="h-3 w-28" />
            <Bone className="h-5 w-16 rounded-full" />
          </div>
          <Bone className="mt-3 h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-2 border-b border-primary-900/6"
        >
          <Bone className="h-3 w-24" />
          <Bone className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
