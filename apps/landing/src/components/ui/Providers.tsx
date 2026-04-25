"use client";

import type { PropsWithChildren } from "react";
import { Toast } from "@heroui/react";

export function Providers({ children }: PropsWithChildren) {
  return (
    <>
      {children}
      <Toast.Provider placement="top end" />
    </>
  );
}
