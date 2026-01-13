import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer } from '@/shared/components/ui';
import { CasesTable } from '..';
import CaseFilters from '@/features/cases/components/CaseFilters';
import CasesTableSkeleton from '@/features/cases/components/CasesTableSkeleton';
import ResultsSummary from '@/shared/components/ui/ResultsSummary';
import type { CaseRow } from '@/features/cases/components/casesTable.utils';
import type { CaseDashboardState } from '../hooks/useCaseDashboard';
import { useAuth } from '@/features/auth/components/AuthContext';

interface CaseDashboardContentProps {
  dashboardState: CaseDashboardState;
  onSearchChange: (search: string) => void;
  onSortChange: (sort: 'recent' | 'oldest') => void;
  onStatusFilterChange: (status: string) => void;
  onPriorityFilterChange: (priority: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onCreateNew: () => void;
  onView: (row: CaseRow) => void;
}

const CaseDashboardContent: React.FC<CaseDashboardContentProps> = ({
  dashboardState,
  onSearchChange,
  onSortChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onPageChange,
  onPageSizeChange,
  onCreateNew,
  onView
}) => {
  const {
    hasComplianceOfficerRole
  } = useAuth();
  const { cases, loading, errorState, filters, pagination } = dashboardState;

  return (
    <PageContainer>
      <div className="min-h-screen bg-gray-50">
        <div className="px-2 sm:px-4 lg:px-6 py-6">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cases Dashboard</h1>
              <p className="mt-2 text-gray-600">Manage and track investigation cases</p>
            </div>
            {!hasComplianceOfficerRole() ? (
              <div className="flex items-center space-x-3">
                <button
                  onClick={onCreateNew}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create Manually
                </button>

              </div>
            ) : (
              <div className="flex items-center space-x-3">


              </div>
            )}
          </div>

          <CaseFilters
            search={filters.search}
            onSearchChange={onSearchChange}
            sortBy={filters.sortBy}
            onSortChange={onSortChange}
            statusFilter={filters.statusFilter}
            onStatusFilterChange={onStatusFilterChange}
            priorityFilter={filters.priorityFilter}
            onPriorityFilterChange={onPriorityFilterChange}
          />

          {errorState && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
              <p className="text-red-600 text-sm">{errorState}</p>
            </div>
          )}
          {loading ? (
            <CasesTableSkeleton rows={pagination.pageSize} />
          ) : (
            <>
              <ResultsSummary
                pagination={{
                  currentPage: pagination.currentPage,
                  pageSize: pagination.pageSize,
                  totalItems: pagination.totalItems,
                }}
                loading={loading}
                lastUpdated={null}
                onPageSizeChange={onPageSizeChange}
                sort={{ column: 'updated_at', direction: filters.sortBy === 'recent' ? 'desc' : 'asc' }}
                itemType="cases"
              />

              <CasesTable
                rows={cases}
                onView={onView}
                pagination={{
                  currentPage: pagination.currentPage,
                  pageSize: pagination.pageSize,
                  totalItems: pagination.totalItems,
                  totalPages: pagination.totalPages,
                  onPageChange: onPageChange,
                }}
              />
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default CaseDashboardContent;