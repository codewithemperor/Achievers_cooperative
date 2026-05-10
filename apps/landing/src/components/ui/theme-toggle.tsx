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
        className={`flex h-9 w-9 items-center justify-center rounded-xl border border-background-200 bg-white text-text-600 transition hover:border-primary-500 hover:bg-primary-50 hover:text-primary-800 dark:border-background-700 dark:bg-background-800 dark:text-text-200 dark:hover:border-primary-400 dark:hover:bg-background-700 dark:hover:text-white ${className}`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-background-200 bg-white text-text-600 transition hover:border-primary-500 hover:bg-primary-50 hover:text-primary-800 dark:border-background-700 dark:bg-background-800 dark:text-text-200 dark:hover:border-primary-400 dark:hover:bg-background-700 dark:hover:text-white ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
