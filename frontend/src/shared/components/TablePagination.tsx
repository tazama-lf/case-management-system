import React from 'react';
import type { TablePaginationProps } from '../types/pagination.types';

const TablePagination: React.FC<TablePaginationProps> = ({
  pagination,
  itemLabel = 'results',
  className = '',
}) => {
  if (!pagination || pagination.totalItems === 0) {
    return null;
  }

  const { currentPage, pageSize, totalItems, totalPages, onPageChange } = pagination;

  // Generate page numbers with ellipsis logic
  const generatePageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);

    const addPage = (p: number) => pages.push(p);
    const addEllipsis = () => pages.push('ellipsis');

    if (totalPages <= windowSize + 2) {
      for (let p = 1; p <= totalPages; p++) addPage(p);
    } else {
      const start = Math.max(2, currentPage - half);
      const end = Math.min(totalPages - 1, currentPage + half);

      addPage(1);
      if (start > 2) addEllipsis();
      for (let p = start; p <= end; p++) addPage(p);
      if (end < totalPages - 1) addEllipsis();
      addPage(totalPages);
    }

    return pages;
  };

  const pages = generatePageNumbers();
  
  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={`bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 ${className}`}>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing{' '}
            <span className="font-medium">{startItem}</span>
            {' '}to{' '}
            <span className="font-medium">{endItem}</span>
            {' '}of{' '}
            <span className="font-medium">{totalItems}</span>
            {' '}{itemLabel}
          </p>
        </div>
        <div>
          <nav
            className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
            aria-label="Pagination"
          >
            {/* Previous Button */}
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {/* Page Numbers */}
            {pages.map((page, idx) =>
              page === 'ellipsis' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-400 select-none"
                >
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                    currentPage === page
                      ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                  aria-current={currentPage === page ? 'page' : undefined}
                >
                  {page}
                </button>
              ),
            )}

            {/* Next Button */}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default TablePagination;