'use client';

import './PaginationControls.css';

type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

type PaginationControlsProps = {
  pagination: PaginationMeta;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export default function PaginationControls({
  pagination,
  loading = false,
  onPrevious,
  onNext,
}: PaginationControlsProps) {
  const currentPage = pagination.total === 0 ? 0 : Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = pagination.total === 0 ? 0 : Math.ceil(pagination.total / pagination.limit);
  const rangeStart = pagination.total === 0 ? 0 : pagination.offset + 1;
  const rangeEnd = pagination.total === 0 ? 0 : Math.min(pagination.offset + pagination.limit, pagination.total);

  return (
    <div className="pagination-controls" aria-label="Paginacion de resultados">
      <div className="pagination-summary">
        <span className="badge badge-blue">
          {rangeStart}-{rangeEnd} de {pagination.total}
        </span>
        <span className="pagination-page-label">
          Pagina {currentPage} de {totalPages}
        </span>
      </div>

      <div className="pagination-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onPrevious}
          disabled={loading || pagination.offset === 0}
        >
          Anterior
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onNext}
          disabled={loading || !pagination.hasMore}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
