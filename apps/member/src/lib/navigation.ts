"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function goBackOrDashboard(router: AppRouterInstance) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }

  router.replace("/dashboard");
}
