"use client";

import type { PropsWithChildren } from "react";
import { HeroUIProvider } from "@heroui/react";

export function AppProvider({ children }: PropsWithChildren) {
  return <HeroUIProvider>{children}</HeroUIProvider>;
}
