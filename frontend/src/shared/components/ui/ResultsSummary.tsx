import React from 'react';

interface ResultsSummaryProps {
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
  };
  loading: boolean;
  lastUpdated: Date | null;
  onPageSizeChange: (size: number) => void;
  sort: {
    column: string;
    direction: 'asc' | 'desc';
  };
  itemType?: string;
}

const ResultsSummary: React.FC<ResultsSummaryProps> = ({ pagination, loading, lastUpdated, onPageSizeChange, sort, itemType = 'alerts' }) => {
  const { currentPage, pageSize, totalItems } = pagination;

  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="text-sm text-gray-600">
        Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} {itemType}
        {loading && (
          <span className="ml-2">
            <div className="inline-block animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
          </span>
        )}
        {lastUpdated && !loading && (
          <span className="ml-4 text-xs text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <label htmlFor="pageSize" className="text-sm text-gray-600">
            Show:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-600">per page</span>
        </div>
        <div className="text-sm text-gray-600">
          Sorted by {sort.column} ({sort.direction === 'asc' ? 'ascending' : 'descending'})
        </div>
      </div>
    </div>
  );
};

export default ResultsSummary;
