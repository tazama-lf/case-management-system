import React from 'react';
import CaseDashboardContent from './CaseDashboardContent';
import CaseModalsManager from './CaseModalsManager';
import { useCaseDashboard } from '../hooks/useCaseDashboard';

const CaseDashboardContainer: React.FC = () => {
  const {
    dashboardState,
    modalState,
    dashboardActions,
    filterActions,
    modalActions,
    caseActions,
    setCurrentPage,
    setPageSize,
    refreshCases,
  } = useCaseDashboard();

  return (
    <>
      <CaseDashboardContent
        dashboardState={dashboardState}
        onSearchChange={filterActions.setSearch}
        onSortChange={filterActions.setSortBy}
        onStatusFilterChange={filterActions.setStatusFilter}
        onPriorityFilterChange={filterActions.setPriorityFilter}
        onSarStrStatusFilterChange={filterActions.setSarStrStatusFilter}
        onCaseTypeFilterChange={filterActions.setCaseTypeFilter}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        onCreateNew={dashboardActions.handleCreateNew}
        onView={dashboardActions.handleView}
      />

      <CaseModalsManager
        modalState={modalState}
        modalActions={modalActions}
        onRefreshCases={refreshCases}
        caseActions={caseActions}
        permissions={dashboardState.permissions}
      />
    </>
  );
};

export default CaseDashboardContainer;
