import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { AlertsSearchFilters } from '../types/alertsdashboard.types';
import { filterService } from '../../cases/services/filterService';
import type { CreateUserFilters, UserFilters } from '../../cases/services/filterService';
import authService from '../../auth/services/authService';
import { useToast } from '@/shared/providers/ToastProvider';


interface AlertsSearchAndFiltersProps {
  searchFilters: AlertsSearchFilters;
  onFilterChange: (key: keyof AlertsSearchFilters, value: string) => void;
  onClearFilters: () => void;
  customDateRange: {
    startDate: string;
    endDate: string;
  };
  onCustomDateRangeChange: (range: { startDate: string; endDate: string }) => void;
  alertTypes?: string[];
  priorities?: string[];
  sources?: string[];
}

export type UserSavedFilter = {
  id: string;
  name: string;
  priority: string;
  alertType: string;
  source: string;
  timeRange: string;
  startDate?: string;
  endDate?: string;
};

interface FilterOptions {
  priorities: string[];
  alertTypes: string[];
  sources: string[];
}

const AlertsSearchAndFilters: React.FC<AlertsSearchAndFiltersProps> = ({
  searchFilters,
  onFilterChange,
  onClearFilters,
  customDateRange,
  onCustomDateRangeChange,

  alertTypes
  , priorities, sources
}) => {
  const { success, error } = useToast();
  const [selectedSavedFilterId, setSelectedSavedFilterId] = React.useState('');
  const [savedFilters, setSavedFilters] = React.useState<UserSavedFilter[]>([]);

  const [showFilters, setShowFilters] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    priorities: [],
    alertTypes: [],
    sources: [],
  });
  const [loadingOptions] = useState(false);

  useEffect(() => {
    setFilterOptions({
      priorities: (priorities && priorities.length > 0) ? priorities : ['NEW', 'URGENT', 'CRITICAL', 'BREACH'],
      alertTypes: (alertTypes && alertTypes.length > 0) ? alertTypes : ['FRAUD', 'AML', 'FRAUD_AND_AML'],
      sources: (sources && sources.length > 0) ? sources : ['System A', 'System B', 'External']
    });
  }, [alertTypes, priorities, sources]);


  const hasActiveFilters = Object.entries(searchFilters).some(
    ([key, value]) => {
      if (key === 'query') return false;
      return value && value !== '';
    },
  );

  const handleTimeRangeChange = (value: string) => {
    onFilterChange('timeRange', value);
    if (value === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const handleCustomDateChange = (
    field: 'startDate' | 'endDate',
    value: string,
  ) => {
    const newRange = { ...customDateRange, [field]: value };
    onCustomDateRangeChange(newRange);
  };

  const handleDeleteSavedFilter = async () => {
    if (!selectedSavedFilterId) return;

    try {
      await filterService.deleteFilter(Number(selectedSavedFilterId));

      success('Filter Deleted', 'Saved filter deleted successfully');
      setSavedFilters(prev =>
        prev.filter(f => f.id !== selectedSavedFilterId)
      );

      setSelectedSavedFilterId('');
      onClearFilters();

    } catch (err: any) {
      console.error('Error deleting filter:', err);
      error(
        'Delete Failed',
        err instanceof Error ? err.message : 'Failed to delete filter'
      );
    }
  };

  const formatDisplayValue = (value: string, type: 'priority' | 'status') => {
    switch (type) {
      case 'priority':
        return value.charAt(0) + value.slice(1).toLowerCase();
      case 'status':
        return value
          .split('_')
          .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
          .join(' ');
      default:
        return value;
    }
  };

  const fetchSavedFilters = React.useCallback(async () => {
    try {
      const currentUser = authService.getUser();
      const userId = currentUser?.userId;
      if (!userId) return;

      const response = await filterService.getFilters(
        userId,
        'Alert',
      );

      const mapped: UserSavedFilter[] = response.map((f: UserFilters) => {
        const parsed = JSON.parse(f.user_filters ?? '{}');

        const baseName = [
          parsed.alertType || 'ALL TYPES',
          parsed.priority || 'ALL PRIORITIES',
          parsed.source || 'ALL SOURCES',
          parsed.timeRange || 'ALL TIME',
        ].join(' - ').toUpperCase();

        const datePart =
          parsed.startDate || parsed.endDate
            ? ` ${[parsed.startDate, parsed.endDate].filter(Boolean).join(' - ')}`
            : '';

        return {
          id: String(f.filter_Id),
          name: baseName + datePart,


          alertType: parsed.alertType ?? '',
          priority: parsed.priority ?? '',
          source: parsed.source ?? '',
          timeRange: parsed.timeRange ?? '',
          startDate: parsed.startDate ?? '',
          endDate: parsed.endDate ?? '',


        };
      });

      setSavedFilters(mapped);
    } catch (error) {
      console.error('Failed to load saved filters', error);
    }
  }, []);

  React.useEffect(() => {
    fetchSavedFilters();
    console.log('Filters updated:', searchFilters);
    setSelectedSavedFilterId('');
  }, [fetchSavedFilters]);



  const handleSavedFilterSelect = (filterId: string) => {
    setSelectedSavedFilterId(filterId);

    const filter = savedFilters.find((f) => f.id === filterId);
    if (!filter) return;

    console.log(JSON.stringify(filter));
    onFilterChange('type', filter.alertType);
    onFilterChange('priority', filter.priority);
    onFilterChange('source', filter.source);
    onFilterChange('timeRange', filter.timeRange);
    setShowCustomDatePicker(filter.timeRange === 'custom');
    if (filter.timeRange === 'custom') {
      setShowCustomDatePicker(true);

      onCustomDateRangeChange({
        startDate: filter.startDate || '',
        endDate: filter.endDate || '',
      });
    } else {
      setShowCustomDatePicker(false);

      onCustomDateRangeChange({
        startDate: '',
        endDate: '',
      });
    }
  };


  const handleSaveCurrentFilters = async () => {
    try {

      const currentUser = authService.getUser();
      const currentUserId = currentUser?.userId;
      const setFilter = searchFilters;
      const payload: CreateUserFilters = {
        user_id: currentUserId,
        filterType: 'Alert',
        userFilters: JSON.stringify({
          alertType: setFilter.type || '',
          priority: setFilter.priority || '',
          source: setFilter.source || '',
          timeRange: setFilter.timeRange || '',
          startDate: customDateRange.startDate || '',
          endDate: customDateRange.endDate || ''

        }),
      };
      const savedFilter = await filterService.createFilter(payload);

      console.log('Saved Filter:', savedFilter);
      success('Filter Created', `Saved with: Alert Type: ${searchFilters.type || 'ALL'}, Priority: ${searchFilters.priority || 'ALL'},
            Source: ${searchFilters.source || 'ALL'}, Time Range: ${searchFilters.timeRange || 'ALL'}, StarDate: ${customDateRange.startDate || 'None'}, EndDate: ${customDateRange.endDate || 'None'}`
      );
    } catch (err: any) {
      console.error('Error saving filter:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save filter';
      error('Create Filter Failed', errorMessage);
    }
  };



  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="p-4">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
          { }
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

          { }
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

          { }
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

      { }
      {showFilters && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          {loadingOptions ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-sm text-gray-500">
                Loading filter options...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              { }
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
                  {(alertTypes && alertTypes.length > 0 ? alertTypes : filterOptions.alertTypes).map((type: string) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              { }
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

              { }
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

              { }
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

          { }
          {showCustomDatePicker && searchFilters.timeRange === 'custom' && (
            <div className="mt-4 p-4 bg-white border border-gray-200 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Custom Date Range
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) =>
                      handleCustomDateChange('startDate', e.target.value)
                    }
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
                    onChange={(e) =>
                      handleCustomDateChange('endDate', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
          {/* Saved Filters & Save Button */}
          <div className="flex flex-col sm:flex-row gap-4 items-end mt-4">
            {/* Saved Filters Dropdown */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Saved Filters
              </label>
              {savedFilters.length > 0 ? (
                <select
                  value={selectedSavedFilterId}
                  onChange={(e) => handleSavedFilterSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a saved filter</option>
                  {savedFilters.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                >
                  <option>No saved filters available</option>
                </select>
              )}
            </div>

            {/* Save Current Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleSaveCurrentFilters}
                className="px-6 py-2 rounded-md bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                Save Current Filters
              </button>
            )}
            {/* Delete Filters */}
            {selectedSavedFilterId && (
              <button
                onClick={handleDeleteSavedFilter}
                className="px-4 py-2 rounded-md bg-red-600 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>

      )}
    </div>
  );
};

export default AlertsSearchAndFilters;
