export interface PageParams { page: number; limit: number; skip: number }

export function pageParams(page: unknown, limit: unknown, maxLimit = 50, defLimit = 20): PageParams {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(maxLimit, Math.max(1, Number(limit) || defLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function pageMeta(total: number, p: PageParams) {
  return { page: p.page, limit: p.limit, total, pages: Math.max(1, Math.ceil(total / p.limit)) };
}
