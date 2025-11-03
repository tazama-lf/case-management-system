import React, { Suspense, lazy } from 'react';
import CaseDashboardContent from './CaseDashboardContent';
import { useCaseDashboard } from '../hooks/useCaseDashboard';

const CaseModalsManager = lazy(() => import('./CaseModalsManager'));

const CaseDashboardContainer: React.FC = () => {
  const {
    dashboardState,
    modalState,
    dashboardActions,
    filterActions,
    modalActions,
    caseActions,
    refreshCases
  } = useCaseDashboard();

  return (
    <>
      <CaseDashboardContent
        dashboardState={dashboardState}
        onSearchChange={filterActions.setSearch}
        onSortChange={filterActions.setSortBy}
        onStatusFilterChange={filterActions.setStatusFilter}
        onPriorityFilterChange={filterActions.setPriorityFilter}
        onCreateNew={dashboardActions.handleCreateNew}
        onView={dashboardActions.handleView}
        onComplete={dashboardActions.handleComplete}
        onCloseCase={dashboardActions.handleCloseCase}
        onReopenCase={dashboardActions.handleReopenCase}
        onAbandonCase={dashboardActions.handleAbandonCase}
        onSuspendCase={dashboardActions.handleSuspendCase}
        onResumeCase={dashboardActions.handleResumeCase}
        onRejectCase={dashboardActions.handleRejectCase}
        onApproveCase={dashboardActions.handleApproveCase}
        onApproveCaseCreation={dashboardActions.handleApproveCaseCreation}
        onRejectCaseCreation={dashboardActions.handleRejectCaseCreation}
        onReturnForReview={dashboardActions.handleReturnForReview}
        onApproveCaseReopen={dashboardActions.handleApproveCaseReopen}
        onRejectCaseReopen={dashboardActions.handleRejectCaseReopen}
      />
      
      <Suspense fallback={<div>Loading...</div>}>
        <CaseModalsManager
          modalState={modalState}
          modalActions={modalActions}
          onRefreshCases={refreshCases}
          caseActions={caseActions}
        />
      </Suspense>
    </>
  );
};

export default CaseDashboardContainer;