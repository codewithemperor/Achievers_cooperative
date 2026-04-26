"use client";

import { clearMemberSession, getMemberSession } from "./member-session";

const FALLBACK_API_URL = "http://localhost:5000/api/v1";

export function getMemberToken() {
  return getMemberSession()?.token ?? null;
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_URL;
}

export async function fetchMemberApi<T>(path: string): Promise<T> {
  const token = getMemberToken();

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearMemberSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function uploadMemberImage(file: File, scope: "member-avatar" | "payment-receipt" | "member-id") {
  const token = getMemberToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scope", scope);

  const response = await fetch(`${getApiBaseUrl()}/uploads/image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Image upload failed");
  }

  return response.json() as Promise<{ url: string; publicId: string }>;
}
