"use client";

export function AdminTabs<T extends string>({
  value,
  onChange,
  items,
  meta,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ id: T; label: string }>;
  meta?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-primary-900/10 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-[var(--background-800)] dark:bg-[var(--background-900)]">
      <div className="flex w-full gap-1 rounded-xl bg-background-100 p-1 sm:w-auto dark:bg-[var(--background-800)]">
        {items.map((item) => (
          <button
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
              value === item.id
                  ? "bg-white text-text-900 shadow-sm dark:bg-[var(--background-700)] dark:text-text-50"
                  : "text-text-500 hover:text-text-900 dark:text-text-400 dark:hover:text-text-100"
            }`}
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      {meta ? <p className="px-2 text-xs font-medium text-text-400">{meta}</p> : null}
    </div>
  );
}
