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
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        onCreateNew={dashboardActions.handleCreateNew}
        onView={dashboardActions.handleView}
        onComplete={dashboardActions.handleComplete}
        onCloseCase={dashboardActions.handleCloseCase}
        onReopenCase={dashboardActions.handleReopenCase}
        onAbandonCase={dashboardActions.handleAbandonCase}
        onSuspendCase={dashboardActions.handleSuspendCase}
        onResumeCase={dashboardActions.handleResumeCase}
        onApproveCase={dashboardActions.handleApproveCase}
        onApproveCaseCreation={dashboardActions.handleApproveCaseCreation}
        onRejectCaseCreation={dashboardActions.handleRejectCaseCreation}
        onApproveCaseReopen={dashboardActions.handleApproveCaseReopen}
        onRejectCaseReopen={dashboardActions.handleRejectCaseReopen}
      />

      <CaseModalsManager
        modalState={modalState}
        modalActions={modalActions}
        onRefreshCases={refreshCases}
        caseActions={caseActions}
      />
    </>
  );
};

export default CaseDashboardContainer;
