interface TablePaginationProps {
  total: number;
  filtered: number;
  page?: number;
}

export function TablePagination({ total, filtered, page = 1 }: TablePaginationProps) {
  return (
    <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface)]">
      <div className="text-[12px] text-[var(--text-muted)]">
        Showing{' '}
        <span className="font-bold text-[var(--text-secondary)]">{filtered > 0 ? 1 : 0}</span> to{' '}
        <span className="font-bold text-[var(--text-secondary)]">{filtered}</span> of{' '}
        <span className="font-bold text-[var(--text-secondary)]">{total}</span> entries
      </div>
      <div className="flex items-center gap-1.5">
        <button
          disabled
          className="px-3 py-[5px] border border-[var(--border)] text-[12px] font-bold rounded-lg text-[var(--text-muted)] bg-[var(--surface)] cursor-not-allowed dm-sans"
        >
          ← First
        </button>
        <button className="px-[14px] py-[5px] border border-[var(--accent)] text-[12px] font-bold rounded-lg text-[var(--accent)] bg-[var(--accent-dim)] shadow-sm dm-sans">
          {page}
        </button>
        <button
          disabled
          className="px-3 py-[5px] border border-[var(--border)] text-[12px] font-bold rounded-lg text-[var(--text-muted)] bg-[var(--surface)] cursor-not-allowed dm-sans"
        >
          Last →
        </button>
      </div>
    </div>
  );
}
