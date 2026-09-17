import type { Context } from 'hono';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface QueryParams {
  pagination: PaginationParams;
  sort: SortParams;
  search?: string;
  filters: Record<string, string | string[] | undefined>;
}

export function parseQueryParams(c: Context, defaultSortBy = 'createdAt'): QueryParams {
  const page = Math.max(1, Number.parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') || '10', 10)));
  const skip = (page - 1) * limit;

  const requestedSort = c.req.query('sortBy') || defaultSortBy;
  const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'status', 'priority', 'dueDate'];
  const sortBy = allowedSortFields.includes(requestedSort) ? requestedSort : defaultSortBy;
  const sortOrder = c.req.query('sortOrder') === 'asc' ? 'asc' : 'desc';

  const search = c.req.query('search') || undefined;

  // Extract filter params (any query param that's not pagination/sort/search)
  const reservedParams = ['page', 'limit', 'sortBy', 'sortOrder', 'search'];
  const filters: Record<string, string | undefined> = {};

  const url = new URL(c.req.url);
  for (const [key, value] of url.searchParams.entries()) {
    if (!reservedParams.includes(key) && value) {
      filters[key] = value;
    }
  }

  return {
    pagination: { page, limit, skip },
    sort: { sortBy, sortOrder },
    search,
    filters,
  };
}

export function buildPaginationMeta(total: number, pagination: PaginationParams) {
  return {
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
    hasNext: pagination.page < Math.ceil(total / pagination.limit),
    hasPrevious: pagination.page > 1,
  };
}

export function buildSuccessResponse(data: unknown, meta?: unknown) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
}
