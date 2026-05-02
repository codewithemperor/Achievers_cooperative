"use client";

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearMemberSession, getMemberSession } from "./member-session";

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

export function getMemberToken() {
  return getMemberSession()?.token ?? null;
}

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
}

// ────────────────────────────────────────────────────────────────────
// Axios instance with interceptors
// ────────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor – attach auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getMemberToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor – handle 401s only
// Toast notifications removed; user-facing feedback goes through SweetAlert2 modals
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      clearMemberSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
    return Promise.reject(error);
  },
);

export default api;

// ────────────────────────────────────────────────────────────────────
// Legacy helper – refactored to use Axios instance
// ────────────────────────────────────────────────────────────────────

export async function fetchMemberApi<T>(path: string): Promise<T> {
  const { data } = await api.get<T>(path);
  return data;
}

// ────────────────────────────────────────────────────────────────────
// Image upload – uses Axios so interceptors apply
// ────────────────────────────────────────────────────────────────────

export async function uploadMemberImage(
  file: File,
  scope: "member-avatar" | "payment-receipt" | "member-id",
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("scope", scope);

  const { data } = await api.post<{ url: string; publicId: string }>(
    "/uploads/image",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return data;
}
