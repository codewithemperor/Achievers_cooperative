export function parsePositiveInt(value: unknown, fallback: number) {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePagination(
  query: { page?: unknown; limit?: unknown } | undefined,
  options: { defaultLimit?: number; maxLimit?: number } = {},
) {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 1000;
  const page = parsePositiveInt(query?.page, 1);
  const limit = Math.min(parsePositiveInt(query?.limit, defaultLimit), maxLimit);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}
