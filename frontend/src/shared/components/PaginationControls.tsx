import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  pageRange: number[];
  itemsPerPageOptions?: number[];
  canGoNext: boolean;
  canGoPrevious: boolean;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  pageRange,
  itemsPerPageOptions = [10, 25, 50, 100],
  canGoNext,
  canGoPrevious,
  onPageChange,
  onItemsPerPageChange,
  onNext,
  onPrevious,
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      {/* Items per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">Show</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="mx-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {itemsPerPageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-700">entries</span>
      </div>

      {/* Page info */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>

        {/* Pagination controls */}
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            {/* Previous button */}
            <button
              onClick={onPrevious}
              disabled={!canGoPrevious}
              className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                canGoPrevious
                  ? 'hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500'
                  : 'cursor-not-allowed opacity-50'
              }`}
            >
              <span className="sr-only">Previous</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Page numbers */}
            {pageRange.map((page) => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                  page === currentPage
                    ? 'z-10 bg-indigo-600 text-white focus:ring-2 focus:ring-indigo-500'
                    : 'text-gray-900 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500'
                }`}
              >
                {page}
              </button>
            ))}

            {/* Next button */}
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 ${
                canGoNext
                  ? 'hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500'
                  : 'cursor-not-allowed opacity-50'
              }`}
            >
              <span className="sr-only">Next</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>

      {/* Mobile pagination */}
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
            canGoPrevious ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-50'
          }`}
        >
          Previous
        </button>
        <span className="flex items-center text-sm text-gray-700">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 ${
            canGoNext ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-50'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PaginationControls;