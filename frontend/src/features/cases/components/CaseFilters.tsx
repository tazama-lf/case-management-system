import React from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { filterService } from '../services/filterService';
import type { CreateUserFilters, UserFilters } from '../services/filterService';
import authService from '../../auth/services/authService';
import { useToast } from '@/shared/providers/ToastProvider';
import { useAuth } from '@/features/auth/components/AuthContext';

interface CaseFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: 'recent' | 'oldest';
  onSortChange: (value: 'recent' | 'oldest') => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (value: string) => void;
  sarStrStatusFilter: string;
  onSarStrStatusFilterChange: (value: string) => void;
  caseTypeFilter: 'all' | 'draft' | 'closed';
  onCaseTypeFilterChange: (value: 'all' | 'draft' | 'closed') => void;
}

export interface UserSavedFilter {
  id: string;
  name: string;
  status: string;
  priority: string;
  sortBy: 'recent' | 'oldest';
  sarStrStatus: string;
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
  sarStrStatusFilter,
  onSarStrStatusFilterChange,
  caseTypeFilter,
  onCaseTypeFilterChange,
}) => {
  const { success, error } = useToast();
  const [showFilters, setShowFilters] = React.useState(false);
  const [selectedSavedFilterId, setSelectedSavedFilterId] = React.useState('');
  const [savedFilters, setSavedFilters] = React.useState<UserSavedFilter[]>([]);

  const { hasComplianceOfficerRole } = useAuth();
  const isComplianceOfficer = hasComplianceOfficerRole();

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'STATUS_99_ABANDONED', label: 'Abandoned' },
    { value: 'STATUS_10_ASSIGNED', label: 'Assigned' },
    { value: 'STATUS_82_CLOSED_CONFIRMED', label: 'Closed - Confirmed' },
    { value: 'STATUS_83_CLOSED_INCONCLUSIVE', label: 'Closed - Inconclusive' },
    { value: 'STATUS_81_CLOSED_REFUTED', label: 'Closed - Refuted' },
    { value: 'STATUS_00_DRAFT', label: 'Draft' },
    { value: 'STATUS_20_IN_PROGRESS', label: 'In Progress' },
    {
      value: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
      label: 'Pending Creation Approval',
    },
    {
      value: 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL',
      label: 'Pending Case Reopening Approval',
    },
    { value: 'STATUS_21_SUSPENDED', label: 'Suspended' },
    {
      value: 'STATUS_22_PENDING_FINAL_APPROVAL',
      label: 'Pending Final Approval',
    },
    { value: 'STATUS_02_READY_FOR_ASSIGNMENT', label: 'Ready for Assignment' },
  ];

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'NEW', label: 'New' },
    { value: 'URGENT', label: 'Urgent' },
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'BREACH', label: 'Breach' },
  ];

  const sarStrStatusOptions = [
    { value: '', label: 'All SAR/STR Statuses' },
    { value: 'STATUS_01_UNASSIGNED', label: 'Unassigned' },
    { value: 'STATUS_10_ASSIGNED', label: 'Assigned' },
    { value: 'STATUS_20_IN_PROGRESS', label: 'In Progress' },
    { value: 'STATUS_30_COMPLETED', label: 'Completed' },
    { value: 'N/A', label: 'No SAR/STR Task' },
  ];

  const hasActiveFilters =
    !!statusFilter ||
    !!priorityFilter ||
    !!sarStrStatusFilter ||
    sortBy !== 'recent' ||
    caseTypeFilter !== 'all';

  // Filter status options based on caseTypeFilter
  const filteredStatusOptions = React.useMemo(() => {
    if (caseTypeFilter === 'closed') {
      // Only show closed statuses
      return statusOptions.filter(
        (opt) =>
          opt.value === '' ||
          opt.value === 'STATUS_82_CLOSED_CONFIRMED' ||
          opt.value === 'STATUS_83_CLOSED_INCONCLUSIVE' ||
          opt.value === 'STATUS_81_CLOSED_REFUTED'
      );
    }
    return statusOptions;
  }, [caseTypeFilter]);

  // Disable status filter when draft is selected
  const isStatusFilterDisabled = caseTypeFilter === 'draft';

  // Clear statusFilter when switching to draft or when it's invalid for closed
  React.useEffect(() => {
    if (caseTypeFilter === 'draft' && statusFilter) {
      onStatusFilterChange('');
    } else if (caseTypeFilter === 'closed' && statusFilter) {
      // Clear if the selected status is not a closed status
      const closedStatuses = [
        'STATUS_82_CLOSED_CONFIRMED',
        'STATUS_83_CLOSED_INCONCLUSIVE',
        'STATUS_81_CLOSED_REFUTED',
        'STATUS_99_ABANDONED',
      ];
      if (!closedStatuses.includes(statusFilter)) {
        onStatusFilterChange('');
      }
    }
  }, [caseTypeFilter, statusFilter, onStatusFilterChange]);

  const fetchSavedFilters = React.useCallback(async (): Promise<void> => {
    try {
      const currentUser = authService.getUser();
      const userId = currentUser?.userId;
      if (!userId) return;

      const response = await filterService.getFilters(userId, 'Case');

      const mapped: UserSavedFilter[] = response.map((f: UserFilters) => {
        const parsed = JSON.parse(f.user_filters ?? '{}');

        return {
          id: String(f.filter_Id),
          name: [
            parsed.sortBy ? parsed.sortBy.toUpperCase() : null,
            parsed.status ? parsed.status.toUpperCase() : null,
            parsed.priority ? parsed.priority.toUpperCase() : null,
            parsed.sarStrStatus ? parsed.sarStrStatus.toUpperCase() : null,
          ]
            .filter(Boolean) // remove null, undefined, or empty strings
            .join(' - '),
          status: parsed.status ?? '',
          priority: parsed.priority ?? '',
          sortBy: parsed.sortBy ?? 'recent',
          sarStrStatus: parsed.sarStrStatus ?? '',
        };
      });

      setSavedFilters(mapped);
    } catch (error) {
      console.error('Failed to load saved filters', error);
    }
  }, []);

  React.useEffect(() => {
    fetchSavedFilters();
  }, [fetchSavedFilters]);

  const handleSavedFilterSelect = (filterId: string): void => {
    setSelectedSavedFilterId(filterId);

    const filter = savedFilters.find((f) => f.id === filterId);
    if (!filter) return;

    onStatusFilterChange(filter.status);
    onPriorityFilterChange(filter.priority);
    onSortChange(filter.sortBy);
    onSarStrStatusFilterChange(filter.sarStrStatus);
  };

  const handleSaveCurrentFilters = async (): Promise<void> => {
    try {
      const currentUser = authService.getUser();
      const currentUserId = currentUser?.userId;

      const payload: CreateUserFilters = {
        user_id: currentUserId,
        filterType: 'Case',
        userFilters: JSON.stringify({
          status: statusFilter,
          priority: priorityFilter,
          sortBy,
          sarStrStatus: sarStrStatusFilter,
        }),
      };

      await filterService.createFilter(payload);

      success(
        'Filter Created',
        `Filter created successfully with status: ${statusFilter},
          priority: ${priorityFilter},
          sortBy: ${sortBy},
          sarStrStatus: ${sarStrStatusFilter}`,
      );

      // Refresh the saved filters list to show the newly created filter
      await fetchSavedFilters();
    } catch (err: unknown) {
      console.error('Error saving filter:', err);

      // Check if it's a duplicate filter error
      if (err instanceof Error && err.message === 'FILTER_ALREADY_EXISTS') {
        error(
          'Filter Already Exists',
          'A filter with the same criteria has already been saved.',
        );
      } else {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to save filter';
        error('Create Filter Failed', errorMessage);
      }
    }
  };

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
            onChange={(e) => {
              onSearchChange(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Case Type Filter Dropdown */}
        <div className="w-48">
          <select
            value={caseTypeFilter}
            onChange={(e) => {
              onCaseTypeFilterChange(
                e.target.value as 'all' | 'draft' | 'closed',
              );
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Cases</option>
            <option value="draft">Draft Cases</option>
            <option value="closed">Closed Cases</option>
          </select>
        </div>

        {/* Filter button */}
        <button
          onClick={() => {
            setShowFilters(!showFilters);
          }}
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
              onSarStrStatusFilterChange('');
              onSortChange('recent');
              onCaseTypeFilterChange('all');
              handleSavedFilterSelect('Select a filter');
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                onSortChange(e.target.value as 'recent' | 'oldest');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Status or SAR/STR Status (conditional based on role) */}
          {!isComplianceOfficer ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  onStatusFilterChange(e.target.value);
                }}
                disabled={isStatusFilterDisabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
              >
                {filteredStatusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SAR/STR Status
              </label>
              <select
                value={sarStrStatusFilter}
                onChange={(e) => {
                  onSarStrStatusFilterChange(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {sarStrStatusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                onPriorityFilterChange(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {priorityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {/* Saved Filters & Save Button */}

          <div className="sm:col-span-3 flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Saved Filters
              </label>
              {savedFilters.length > 0 ? (
                <select
                  value={selectedSavedFilterId}
                  onChange={(e) => {
                    handleSavedFilterSelect(e.target.value);
                  }}
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

            {hasActiveFilters && (
              <button
                onClick={() => { void handleSaveCurrentFilters(); }}
                className="px-4 py-2 rounded-md bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                Save Current Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseFilters;
