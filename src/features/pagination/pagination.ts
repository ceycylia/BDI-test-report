export const ADMIN_PAGE_SIZE = 20;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PageItem = number | `ellipsis-${number}`;

export function paginationItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const valid = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items: PageItem[] = [];
  valid.forEach((page, index) => {
    if (index > 0 && page - valid[index - 1]! > 1) items.push(`ellipsis-${page}`);
    items.push(page);
  });
  return items;
}
