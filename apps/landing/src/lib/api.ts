"use client";

import axios from "axios";
import { clearSession, getSession } from "./session";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const session = getSession();
  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/admin/auth/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;

const MAX_UPLOAD_BYTES = 100 * 1024;

async function blobFromCanvas(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to compress image."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function loadImage(file: File) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image file."));
    };
    image.src = objectUrl;
  });
}

async function compressImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload a valid image file.");
  }

  if (file.size <= MAX_UPLOAD_BYTES && file.type === "image/webp") {
    return file;
  }

  const source = await loadImage(file);
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  let maxSide = Math.min(Math.max(sourceWidth, sourceHeight), 1600);

  while (maxSide >= 320) {
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is not available.");
    context.drawImage(source, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.44, 0.36]) {
      const blob = await blobFromCanvas(canvas, quality);
      if (blob.size <= MAX_UPLOAD_BYTES) {
        return new File(
          [blob],
          `${file.name.replace(/\.[^.]+$/, "") || "upload"}.webp`,
          {
            type: "image/webp",
            lastModified: Date.now(),
          },
        );
      }
    }

    maxSide = Math.floor(maxSide * 0.78);
  }

  throw new Error(
    "Please choose a smaller or clearer image. It must compress below 100KB.",
  );
}

export async function uploadAdminImage(
  file: File,
  scope: "member-avatar" | "payment-receipt" | "member-id",
) {
  const compressedFile = await compressImageForUpload(file);
  const formData = new FormData();
  formData.append("file", compressedFile);
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
