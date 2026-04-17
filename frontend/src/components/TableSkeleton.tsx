'use client';

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  className?: string;
}

export default function TableSkeleton({ columns, rows = 4, className = '' }: TableSkeletonProps) {
  return (
    <div className={`table-container skeleton-table ${className}`.trim()} aria-hidden="true">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={`header-${index}`}>
                <span className="skeleton-line skeleton-line--header" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {Array.from({ length: columns }).map((__, columnIndex) => (
                <td key={`cell-${rowIndex}-${columnIndex}`}>
                  <span
                    className={`skeleton-line ${
                      columnIndex === columns - 1 ? 'skeleton-line--narrow' : 'skeleton-line--medium'
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
