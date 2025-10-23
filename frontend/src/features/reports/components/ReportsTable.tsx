import React from 'react';
import type { CaseStatusDetail } from '../types/reports.types';
import { usePagination } from '../../../shared/hooks/usePagination';
import PaginationControls from '../../../shared/components/PaginationControls';

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
            {onExportExcel && (
              <button
                onClick={onExportExcel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Export as Excel
              </button>
            )}
            {onExportCSV && (
              <button
                onClick={onExportCSV}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Export as CSV
              </button>
            )}
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Export as PDF
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <colgroup>
            <col className="w-40" />
            <col className="w-24" />
            <col className="w-32" />
            <col className="w-40" />
            <col className="w-48" />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Count
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Percentage
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Time in Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Current Trend Period
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <p className="text-lg font-medium">No data available</p>
                    <p className="mt-1">There are no case status records to display.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
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
    </div>
  );
};

export default ReportsTable;
