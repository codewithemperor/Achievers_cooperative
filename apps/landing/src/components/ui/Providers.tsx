"use client";

import type { PropsWithChildren } from "react";
import { ThemeProvider } from "next-themes";
import { Toast } from "@heroui/react";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
      <Toast.Provider placement="top end" />
    </ThemeProvider>
  );
}
