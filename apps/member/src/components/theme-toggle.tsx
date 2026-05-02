"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--background-200)] bg-white transition hover:bg-[var(--background-100)] dark:border-white/10 dark:bg-white/10 ${className}`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 text-[var(--text-400)] dark:text-white" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--background-200)] bg-white transition hover:bg-[var(--background-100)] dark:border-white/10 dark:bg-white/10 ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-white" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--text-500)]" />
      )}
    </button>
  );
}
