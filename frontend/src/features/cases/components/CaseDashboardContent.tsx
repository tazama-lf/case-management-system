import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '@/shared/components/ui';
import { CasesTable } from '..';
import CaseFilters from '@/features/cases/components/CaseFilters';
import CasesTableSkeleton from '@/features/cases/components/CasesTableSkeleton';
import ResultsSummary from '@/shared/components/ui/ResultsSummary';
import type { CaseRow } from '@/features/cases/components/CasesTable';
import type { CaseDashboardState } from '../hooks/useCaseDashboard';

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
  onComplete: (row: CaseRow) => void;
  onCloseCase: (row: CaseRow) => void;
  onReopenCase: (row: CaseRow) => void;
  onAbandonCase: (row: CaseRow) => void;
  onSuspendCase: (row: CaseRow) => void;
  onResumeCase: (row: CaseRow) => void;
  onRejectCase: (row: CaseRow) => void;
  onApproveCase: (row: CaseRow) => void;
  onApproveCaseCreation: (row: CaseRow) => void;
  onRejectCaseCreation: (row: CaseRow) => void;
  onReturnForReview: (row: CaseRow) => void;
  onApproveCaseReopen: (row: CaseRow) => void;
  onRejectCaseReopen: (row: CaseRow) => void;
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
  onView,
  onComplete,
  onCloseCase,
  onReopenCase,
  onAbandonCase,
  onSuspendCase,
  onResumeCase,
  onRejectCase,
  onApproveCase,
  onApproveCaseCreation,
  onRejectCaseCreation,
  onReturnForReview,
  onApproveCaseReopen,
  onRejectCaseReopen
}) => {
  const { cases, loading, errorState, filters, pagination } = dashboardState;

  return (
    <PageContainer
      title="Cases Dashboard"
      subtitle="Manage and track investigation cases"
      actions={
        <button 
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Create Manually
        </button>
      }
    >
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

      <Card className="mt-4">
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
              onComplete={onComplete}
              onCloseCase={onCloseCase}
              onReopenCase={onReopenCase}
              onAbandonCase={onAbandonCase}
              onSuspendCase={onSuspendCase}
              onResumeCase={onResumeCase}
              onRejectCase={onRejectCase}
              onApproveCase={onApproveCase}
              onApproveCaseCreation={onApproveCaseCreation}
              onRejectCaseCreation={onRejectCaseCreation}
              onReturnForReview={onReturnForReview}
              onApproveCaseReopen={onApproveCaseReopen}
              onRejectCaseReopen={onRejectCaseReopen}
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
      </Card>
    </PageContainer>
  );
};

export default CaseDashboardContent;