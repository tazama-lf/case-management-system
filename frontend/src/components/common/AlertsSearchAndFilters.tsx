import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AlertsSearchFilters } from '../../types/alertsdashboard.types';
import useDebounce from '../../hooks/useDebounce';
import triageService from '../../services/triageservice';

interface AlertsSearchAndFiltersProps {
  searchFilters: AlertsSearchFilters;
  onFilterChange: (key: keyof AlertsSearchFilters, value: string) => void;
  onClearFilters: () => void;
  customDateRange: {
    startDate: string;
    endDate: string;
  };
  onCustomDateRangeChange: (range: { startDate: string; endDate: string }) => void;
  onSearch?: (query: string) => void; // For real-time search callback
}

interface FilterOptions {
  priorities: string[];
  statuses: string[];
  types: string[];
  sources: string[];
}

const AlertsSearchAndFilters: React.FC<AlertsSearchAndFiltersProps> = ({
  searchFilters,
  onFilterChange,
  onClearFilters,
  customDateRange,
  onCustomDateRangeChange,
  onSearch
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    priorities: [],
    statuses: [],
    types: [],
    sources: []
  });
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Debounced search with 300ms delay
  const debouncedQuery = useDebounce(searchFilters.query, 300);

  // Load filter options from backend
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setLoadingOptions(true);
        const options = await triageService.getFilterOptions();
        setFilterOptions(options);
      } catch (error) {
        console.error('Failed to load filter options:', error);
        // Fallback to static options if API fails
        setFilterOptions({
          priorities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          statuses: ['NEW', 'INVESTIGATING', 'CLOSED', 'CONVERTED'],
          types: ['Transaction Monitoring', 'AML Screening', 'Velocity Check'],
          sources: ['REST API', 'Transaction Monitoring System']
        });
      } finally {
        setLoadingOptions(false);
      }
    };

    loadFilterOptions();
  }, []);

  // Trigger search when debounced query changes
  useEffect(() => {
    if (onSearch && debouncedQuery !== searchFilters.query) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch, searchFilters.query]);

  const hasActiveFilters = Object.entries(searchFilters).some(([key, value]) => {
    if (key === 'query') return false; // Don't count search query as filter
    return value && value !== '';
  });

  const handleTimeRangeChange = (value: string) => {
    onFilterChange('timeRange', value);
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newRange = { ...customDateRange, [field]: value };
    onCustomDateRangeChange(newRange);
  };

  const formatDisplayValue = (value: string, type: 'priority' | 'status') => {
    switch (type) {
      case 'priority':
        return value.charAt(0) + value.slice(1).toLowerCase();
      case 'status':
        return value.split('_').map(word => 
          word.charAt(0) + word.slice(1).toLowerCase()
        ).join(' ');
      default:
        return value;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Alert ID, title, or keywords..."
                value={searchFilters.query}
                onChange={(e) => onFilterChange('query', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle */}
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

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <XMarkIcon className="h-5 w-5 mr-2" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          {loadingOptions ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-sm text-gray-500">Loading filter options...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alert Type
                </label>
                <select
                  value={searchFilters.type || ''}
                  onChange={(e) => onFilterChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  {filterOptions.types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={searchFilters.priority}
                  onChange={(e) => onFilterChange('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Priorities</option>
                  {filterOptions.priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {formatDisplayValue(priority, 'priority')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={searchFilters.status}
                  onChange={(e) => onFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  {filterOptions.statuses.map((status) => (
                    <option key={status} value={status}>
                      {formatDisplayValue(status, 'status')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <select
                  value={searchFilters.source || ''}
                  onChange={(e) => onFilterChange('source', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Sources</option>
                  {filterOptions.sources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Range
                </label>
                <select
                  value={searchFilters.timeRange}
                  onChange={(e) => handleTimeRangeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="thisWeek">This Week</option>
                  <option value="last7days">Last 7 Days</option>
                  <option value="thisMonth">This Month</option>
                  <option value="last30days">Last 30 Days</option>
                  <option value="last90days">Last 90 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>
          )}

          {/* Custom Date Range Picker */}
          {showCustomDatePicker && searchFilters.timeRange === 'custom' && (
            <div className="mt-4 p-4 bg-white border border-gray-200 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Date Range</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customDateRange.endDate}
                    onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsSearchAndFilters;
