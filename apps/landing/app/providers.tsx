"use client";

import type { PropsWithChildren } from "react";
import { AppProvider } from "@achievers/ui";

export function Providers({ children }: PropsWithChildren) {
  return <AppProvider>{children}</AppProvider>;
}
