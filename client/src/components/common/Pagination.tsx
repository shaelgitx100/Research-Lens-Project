export default function Pagination({ page, pages, onPageChange }: { page: number; pages: number; onPageChange(page: number): void }) {
  if (pages <= 1) return null;
  return <nav className="pagination" aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button><span aria-live="polite">Page {page} of {pages}</span><button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button></nav>;
}
