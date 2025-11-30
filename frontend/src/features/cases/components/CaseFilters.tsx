import React from 'react';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface CaseFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: 'recent' | 'oldest';
  onSortChange: (value: 'recent' | 'oldest') => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
}

const CaseFilters: React.FC<CaseFiltersProps> = ({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
}) => {
  const [showFilters, setShowFilters] = React.useState(false);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'STATUS_00_DRAFT', label: 'Draft' },
    { value: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL', label: 'Pending Creation Approval' },
    { value: 'STATUS_20_IN_PROGRESS', label: 'In Progress' },
    { value: 'STATUS_21_SUSPENDED', label: 'Suspended' },
    { value: 'STATUS_22_PENDING_FINAL_APPROVAL', label: 'Pending Final Approval' },
    { value: 'STATUS_81_CLOSED_REFUTED', label: 'Closed - Refuted' },
    { value: 'STATUS_82_CLOSED_CONFIRMED', label: 'Closed - Confirmed' },
    { value: 'STATUS_83_CLOSED_INCONCLUSIVE', label: 'Closed - Inconclusive' },
  ];

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'NEW', label: 'New' },
    { value: 'URGENT', label: 'Urgent' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'BREACH', label: 'Breach' },
  ];

  const hasActiveFilters =
    !!statusFilter || !!priorityFilter || sortBy !== 'recent';

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-4 sm:space-y-0">
        {/* Search */}
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search cases..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filter button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <FunnelIcon className="h-5 w-5 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Active
            </span>
          )}
        </button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              onStatusFilterChange('');
              onPriorityFilterChange('');
              onSortChange('recent');
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <XMarkIcon className="h-5 w-5 mr-2" />
            Clear
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 bg-gray-50 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Sort */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as 'recent' | 'oldest')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Status */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => onPriorityFilterChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {priorityOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseFilters;