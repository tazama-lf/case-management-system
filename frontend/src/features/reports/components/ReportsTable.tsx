import React, { Suspense } from 'react';
import type { CaseStatusDetail } from '../types/reports.types';
import { usePagination } from '../../../shared/hooks/usePagination';

const PaginationControls = React.lazy(() => import('../../../shared/components/PaginationControls'));

interface ReportsTableProps {
  data: CaseStatusDetail[];
  title: string;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

const ReportsTable: React.FC<ReportsTableProps> = ({ 
  data, 
  title, 
  onExportExcel, 
  onExportCSV, 
  onExportPDF 
}) => {
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedData,
    setCurrentPage,
    setItemsPerPage,
    goToNextPage,
    goToPreviousPage,
    canGoNext,
    canGoPrevious,
    pageRange,
  } = usePagination({
    data,
    defaultItemsPerPage: 10,
  });

  const exportActions = [
    { label: 'Export as Excel', onClick: onExportExcel, key: 'excel' },
    { label: 'Export as CSV', onClick: onExportCSV, key: 'csv' },
    { label: 'Export as PDF', onClick: onExportPDF, key: 'pdf' },
  ].filter(action => action.onClick);

  const tableHeaders = [
    { label: 'Status', width: 'w-40', key: 'status' },
    { label: 'Count', width: 'w-24', key: 'count' },
    { label: 'Percentage', width: 'w-32', key: 'percentage' },
    { label: 'Avg Time in Status', width: 'w-40', key: 'avgTime' },
    { label: 'Current Trend Period', width: 'w-48', key: 'trend' },
  ];

  const getTrendColor = (trend: string) => {
    if (trend.startsWith('+')) return 'text-green-600';
    if (trend.startsWith('-')) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 pb-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">
            {exportActions.map(({ label, onClick, key }) => (
              <button
                key={key}
                onClick={onClick}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <colgroup>
            {tableHeaders.map((header) => (
              <col key={header.key} className={header.width} />
            ))}
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              {tableHeaders.map((header) => (
                <th 
                  key={header.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={tableHeaders.length} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <p className="text-lg font-medium">No data available</p>
                    <p className="mt-1">There are no case status records to display.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr key={`${row.status}-${row.count}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="break-words">
                      {row.status}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.count}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.percentage}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">
                      {row.avgTimeInStatus}
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${getTrendColor(row.currentTrendPeriod)}`}>
                    <div className="break-words">
                      {row.currentTrendPeriod}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Suspense fallback={<div className="bg-gray-200 h-16 rounded-lg animate-pulse"></div>}>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={data.length}
          pageRange={pageRange}
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          onNext={goToNextPage}
          onPrevious={goToPreviousPage}
        />
      </Suspense>
    </div>
  );
};

export default ReportsTable;
