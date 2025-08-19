import React, { useState } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, CalendarIcon } from '@heroicons/react/24/outline';
import type { AlertsSearchFilters, AlertsSearchWithFiltersProps } from '../../types/alertsdashboard.types';

const AlertsSearchWithFilters: React.FC<AlertsSearchWithFiltersProps> = ({
  onSearch,
  onClear,
  placeholder = "Search alerts...",
  sources = ['All Sources', 'Transaction Monitor', 'AML Engine', 'KYC System', 'Fraud Detection'],
  types = ['All Types', 'High Value Transaction', 'Suspicious Pattern', 'AML Violation', 'KYC Issue', 'Geographic Anomaly', 'Velocity Check', 'Sanctions Screening'],
  priorities = ['All Priorities', 'low', 'medium', 'high', 'critical'],
  statuses = ['All Statuses', 'new', 'investigating', 'resolved', 'false_positive']
}) => {
  const [filters, setFilters] = useState<AlertsSearchFilters>({
    query: '',
    source: 'All Sources',
    type: 'All Types',
    priority: 'All Priorities',
    status: 'All Statuses',
    timeRange: 'all',
    startDate: '',
    endDate: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  const timeRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const handleInputChange = (field: keyof AlertsSearchFilters, value: string) => {
    const updatedFilters = {
      ...filters,
      [field]: value
    };
    setFilters(updatedFilters);
    
    // Auto-search as user types (debounced in parent component)
    if (field === 'query') {
      onSearch(updatedFilters);
    }
  };

  const handleFilterChange = (field: keyof AlertsSearchFilters, value: string) => {
    const updatedFilters = {
      ...filters,
      [field]: value
    };
    setFilters(updatedFilters);
    onSearch(updatedFilters);
  };

  const handleClear = () => {
    const clearedFilters: AlertsSearchFilters = {
      query: '',
      source: 'All Sources',
      type: 'All Types',
      priority: 'All Priorities',
      status: 'All Statuses',
      timeRange: 'all',
      startDate: '',
      endDate: ''
    };
    setFilters(clearedFilters);
    onClear();
  };

  const isCustomTimeRange = filters.timeRange === 'custom';
  const hasActiveFilters = filters.query || 
    filters.source !== 'All Sources' || 
    filters.type !== 'All Types' ||
    filters.priority !== 'All Priorities' ||
    filters.status !== 'All Statuses' ||
    filters.timeRange !== 'all';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      {/* Main Search Row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={filters.query}
            onChange={(e) => handleInputChange('query', e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={placeholder}
          />
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-4 py-2 border rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 ${
            showFilters || hasActiveFilters
              ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FunnelIcon className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
              {[
                filters.source !== 'All Sources', 
                filters.type !== 'All Types',
                filters.priority !== 'All Priorities',
                filters.status !== 'All Statuses',
                filters.timeRange !== 'all'
              ].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Source Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source
              </label>
              <select
                value={filters.source}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status === 'All Statuses' ? status : 
                     status === 'false_positive' ? 'False Positive' :
                     status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range Filter */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Range
              </label>
              <select
                value={filters.timeRange}
                onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {timeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Date Range (only shown when Custom Range is selected) */}
            {isCustomTimeRange && (
              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Date Range
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Start Date"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="End Date"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsSearchWithFilters;
