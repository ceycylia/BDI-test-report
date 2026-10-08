export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 20;

export type PaginationInput = {
  page: number;
  limit: number;
  offset: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(
  query: { page?: string; limit?: string; pageSize?: string },
): PaginationInput {
  const page = positiveInteger(query.page, 1);
  const requestedLimit = positiveInteger(
    query.limit ?? query.pageSize,
    DEFAULT_PAGE_SIZE,
  );
  const limit = Math.min(requestedLimit, MAX_PAGE_SIZE);
  return { page, limit, offset: (page - 1) * limit };
}

export function paginationMeta(
  input: Pick<PaginationInput, "page" | "limit">,
  total: number,
): PaginationMeta {
  return {
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  };
}
