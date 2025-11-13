import React from 'react';
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

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
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' },
    {
      value: 'PENDING_CASE_CREATION_APPROVAL',
      label: 'Pending Creation Approval',
    },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'PENDING_FINAL_APPROVAL', label: 'Pending Final Approval' },
    { value: 'STATUS_81_CLOSED_REFUTED', label: 'Closed - Refuted' },
    { value: 'STATUS_82_CLOSED_CONFIRMED', label: 'Closed - Confirmed' },
    { value: 'STATUS_83_CLOSED_INCONCLUSIVE', label: 'Closed - Inconclusive' },
  ];

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' },
  ];

  return (
    <div className="mb-6 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search cases..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4">
        {/* Sort By */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) =>
              onSortChange(e.target.value as 'recent' | 'oldest')
            }
            className="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-8 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-8 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Priority Filter */}
        <div className="relative">
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-8 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseFilters;
