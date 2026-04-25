"use client";

import { toast } from "@heroui/react";

export function showSuccessToast(message: string) {
  toast.success(message);
}

export function showErrorToast(message: string) {
  toast.danger(message);
}
