import React from 'react';
import { EyeIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';
import { getScoreColor } from './casesTable.utils';

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface CasesTableProps {
  rows: CaseRow[];
  onView: (row: CaseRow) => void;
  pagination?: PaginationInfo;
}

const CasesTable: React.FC<CasesTableProps> = ({ 
  rows, 
  onView, 
  pagination
}) => {

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="w-32 px-0.5 py-1 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
              <span className="hidden sm:inline">Case ID</span>
              <span className="sm:hidden">ID</span>
            </th>
            <th scope="col" className="w-24 px-0.5 py-1 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
              <span className="hidden lg:inline">Case Type</span>
              <span className="lg:hidden">Type</span>
            </th>
            <th scope="col" className="w-20 px-0.5 py-1 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Status</th>
            <th scope="col" className="w-16 px-0.5 py-1 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
              <span className="hidden sm:inline">Score</span>
              <span className="sm:hidden">%</span>
            </th>
            <th scope="col" className="hidden md:table-cell w-24 px-0.5 py-1 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Created</th>
            <th scope="col" className="w-32 px-0.5 py-1 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50/50">
              <td className="w-32 px-0.5 py-1 whitespace-nowrap">
                <div className="text-xs text-gray-900 font-mono" title={c.id}>
                  {c.id}
                </div>
              </td>
              <td className="w-24 px-0.5 py-1">
                <div className="text-xs text-gray-900" title={c.type}>
                  {c.type || 'N/A'}
                </div>
              </td>
              <td className="w-20 px-0.5 py-1">
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-gray-200 whitespace-nowrap ${c.statusColor}`}>
                  {c.status}
                </span>
              </td>
              <td className="w-16 px-0.5 py-1">
                <span className={`inline-flex px-1.5 py-0.5 text-xs font-bold rounded-full whitespace-nowrap ${getScoreColor(c.score)}`}>
                  {c.score}%
                </span>
              </td>
              <td className="hidden md:table-cell w-24 px-0.5 py-1 text-xs text-gray-700 whitespace-nowrap">
                <div title={c.createdOn}>
                  {c.createdOn}
                </div>
              </td>
              <td className="w-32 px-0.5 py-1">
                <div className="flex justify-end gap-0.5 flex-wrap">
                  <button
                    onClick={() => onView(c)}
                    className="inline-flex items-center gap-0.5 rounded bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 whitespace-nowrap"
                  >
                    <EyeIcon className="h-2.5 w-2.5" />
                    <span className="hidden sm:inline">View</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      {pagination && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {Math.min(
                    (pagination.currentPage - 1) * pagination.pageSize + 1,
                    pagination.totalItems,
                  )}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(
                    pagination.currentPage * pagination.pageSize,
                    pagination.totalItems,
                  )}
                </span>{' '}
                of <span className="font-medium">{pagination.totalItems}</span>{' '}
                results
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                <button
                  onClick={() =>
                    pagination.onPageChange(Math.max(1, pagination.currentPage - 1))
                  }
                  disabled={pagination.currentPage <= 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {}
                {(() => {
                  const { currentPage, totalPages } = pagination;
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

                  return pages.map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-400 select-none"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => pagination.onPageChange(p)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          pagination.currentPage === p
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                        aria-current={pagination.currentPage === p ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    ),
                  );
                })()}
                <button
                  onClick={() =>
                    pagination.onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))
                  }
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CasesTable;