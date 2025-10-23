import React from 'react';
import type { InvestigatorPerformance } from '../types/reports.types';
import { usePagination } from '../../../shared/hooks/usePagination';
import PaginationControls from '../../../shared/components/PaginationControls';

interface InvestigatorPerformanceTableProps {
  data: InvestigatorPerformance[];
  title: string;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

const InvestigatorPerformanceTable: React.FC<InvestigatorPerformanceTableProps> = ({
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

  const getTrendColor = (trend: string | undefined) => {
    if (!trend) return 'text-gray-600';
    if (trend.toLowerCase().includes('declining')) return 'text-red-600';
    if (trend.toLowerCase().includes('improving')) return 'text-green-600';
    return 'text-gray-600';
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No performance data available</p>
        </div>
      </div>
    );
  }

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
            <col className="w-72" />  {/* Investigator ID - wider for full UUID */}
            <col className="w-48" />  {/* Investigator */}
            <col className="w-32" />  {/* Role */}
            <col className="w-28" />  {/* Active Cases */}
            <col className="w-32" />  {/* Completed Cases */}
            <col className="w-40" />  {/* Avg. Resolution Time */}
            <col className="w-36" />  {/* Case Closure Rate */}
            <col className="w-36" />  {/* Performance Trend */}
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Investigator ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Investigator
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active Cases
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Completed Cases
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg. Resolution Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Case Closure Rate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Performance Trend
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <p className="text-lg font-medium">No data available</p>
                    <p className="mt-1">There are no investigator performance records to display.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-900 font-mono">
                    <div className="break-all" title={(row as any).investigatorId || (row as any).investigator_id || (row as any).userId || (row as any).user_id || ''}>
                      {(row as any).investigatorId || (row as any).investigator_id || (row as any).userId || (row as any).user_id || 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="break-words">
                      {row.investigator || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">
                      {row.role || 'Investigator'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.activeCases || 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.completedCases || 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.avgResolutionTime || 0} days
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {row.caseClosureRate || 0}%
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${getTrendColor(row.performanceTrend)}`}>
                    <div className="break-words">
                      {row.performanceTrend || 'Stable'}
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

export default InvestigatorPerformanceTable;
