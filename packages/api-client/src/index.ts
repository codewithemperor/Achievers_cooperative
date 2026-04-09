export const API_PREFIX = "/api/v1";

export interface ApiClientConfig {
  baseUrl: string;
  accessToken?: string;
}

export function createApiUrl(config: ApiClientConfig, path: string) {
  const normalizedBase = config.baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${API_PREFIX}${normalizedPath}`;
}

export const generatedClientNotice =
  "Replace this placeholder with a generated client after the first OpenAPI export from apps/api.";
