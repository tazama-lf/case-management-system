import React from 'react';
import type { TaskDetail } from '../types/reports.types';
import { usePagination } from '../../../shared/hooks/usePagination';
import PaginationControls from '../../../shared/components/PaginationControls';

interface TaskCompletionTableProps {
  data: TaskDetail[];
  title: string;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

const TaskCompletionTable: React.FC<TaskCompletionTableProps> = ({
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

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
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
            <col className="w-48" />  {/* Task Type */}
            <col className="w-24" />  {/* Total */}
            <col className="w-28" />  {/* Completed */}
            <col className="w-36" />  {/* Completion Rate */}
            <col className="w-36" />  {/* Avg. Time (Days) */}
            <col className="w-24" />  {/* Trend */}
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Task Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completed
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completion Rate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg. Time (Days)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <p className="text-lg font-medium">No data available</p>
                    <p className="mt-1">There are no task completion records to display.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="break-words">
                      {row.taskType}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.total}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.completed}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.completionRate}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.avgTime}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${getTrendColor(row.trend)}`}>
                    {row.trend > 0 ? '+' : ''}{row.trend}%
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

export default TaskCompletionTable;
