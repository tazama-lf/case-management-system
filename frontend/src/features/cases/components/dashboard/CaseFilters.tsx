import React from 'react';
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { Card } from '../../../../shared/components/ui';

interface CaseFiltersProps {
  search: string;
  setSearch: (search: string) => void;
  sortBy: 'recent' | 'oldest';
  setSortBy: (sortBy: 'recent' | 'oldest') => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  priorityFilter: string;
  setPriorityFilter: (priority: string) => void;
}

const CaseFilters: React.FC<CaseFiltersProps> = ({
  search,
  setSearch,
  sortBy,
  setSortBy,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
}) => (
  <Card className="bg-indigo-50/40" padding="sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-[160px]">
          <select
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="STATUS_10_ASSIGNED">Assigned</option>
            <option value="STATUS_20_IN_PROGRESS">In Progress</option>
            <option value="STATUS_00_DRAFT">Draft</option>
            <option value="STATUS_31_REOPENED">Reopened</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        <div className="relative w-full sm:max-w-[160px]">
          <select
            aria-label="Priority filter"
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
            }}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="NEW">New</option>
            <option value="URGENT">Urgent</option>
            <option value="CRITICAL">Critical</option>
            <option value="BREACH">Breach</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        <div className="relative w-full">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Search..."
            className="w-full rounded-md border border-gray-300 bg-white px-10 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="relative w-full sm:max-w-[160px]">
          <select
            aria-label="Sort by"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as 'recent' | 'oldest');
            }}
            className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  </Card>
);

export default CaseFilters;
