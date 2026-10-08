import { paginationItems, type PaginationMeta } from "../../features/pagination/pagination";

export { ADMIN_PAGE_SIZE, type PaginationMeta } from "../../features/pagination/pagination";

export function Pagination({
  pagination,
  itemLabel,
  loading = false,
  onPageChange,
}: {
  pagination: PaginationMeta;
  itemLabel: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const { page, limit, total, totalPages } = pagination;
  const start = total ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, total);

  return (
    <footer className="app-pagination" aria-label={`Navigasi halaman ${itemLabel}`} aria-busy={loading}>
      <span className="app-pagination__summary">
        Menampilkan {start}–{end} dari {total} {itemLabel}
      </span>
      {totalPages > 1 && <div className="app-pagination__controls">
        <button type="button" className="button button--secondary button--small" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>
          ‹ Sebelumnya
        </button>
        <div className="app-pagination__pages" aria-label="Nomor halaman">
          {paginationItems(page, totalPages).map((item) => typeof item === "number" ? (
            <button key={item} type="button" className={item === page ? "pagination-page is-active" : "pagination-page"} aria-current={item === page ? "page" : undefined} disabled={loading} onClick={() => onPageChange(item)}>{item}</button>
          ) : <span key={item} className="pagination-ellipsis" aria-hidden="true">…</span>)}
        </div>
        <span className="app-pagination__mobile-page">Halaman {page} dari {totalPages}</span>
        <button type="button" className="button button--secondary button--small" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Selanjutnya ›
        </button>
      </div>}
    </footer>
  );
}
