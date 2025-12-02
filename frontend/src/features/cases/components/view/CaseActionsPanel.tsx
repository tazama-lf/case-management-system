import React from 'react';
import { CheckIcon, XCircleIcon, PlayIcon, PauseIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from '../casesTable.utils';
//interface
interface CaseActionsPanelProps {
  caseData: CaseRow;
  canManageSupervisorActions: boolean;
  onComplete?: (row: CaseRow) => void;
  onCloseCase?: (row: CaseRow) => void;
  onReopenCase?: (row: CaseRow) => void;
  onAbandonCase?: (row: CaseRow) => void;
  onSuspendCase?: (row: CaseRow) => void;
  onResumeCase?: (row: CaseRow) => void;
  onApproveCase?: (row: CaseRow) => void;
  onApproveCaseReopen?: (row: CaseRow) => void;
  onRejectCaseReopen?: (row: CaseRow) => void;
  onApproveCaseCreation?: (row: CaseRow) => void;
  onRejectCaseCreation?: (row: CaseRow) => void;
}

const CaseActionsPanel: React.FC<CaseActionsPanelProps> = ({
  caseData,
  canManageSupervisorActions,
  onComplete,
  onCloseCase,
  onReopenCase,
  onAbandonCase,
  onSuspendCase,
  onResumeCase,
  onApproveCase,
  onApproveCaseReopen,
  onRejectCaseReopen,
  onApproveCaseCreation,
  onRejectCaseCreation
}) => {
  const showSupervisorControls = canManageSupervisorActions;

  const getAvailableActions = () => {
    const actions: React.ReactNode[] = [];

    // Complete action
    if (caseData.action === 'Complete' && onComplete) {
      actions.push(
        <button
          key="complete"
          onClick={() => onComplete(caseData)}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <CheckIcon className="h-4 w-4" />
          Complete Case
        </button>
      );
    }

    // Close Case button - show for in-progress cases when ALL investigation tasks are completed
    const investigateTasks = caseData?.tasks?.filter((t) => t.name.startsWith('Investigate')) || [];
    const completedInvestigateTasks = investigateTasks.filter((t) => t.status === 'STATUS_30_COMPLETED');
    
    if (onCloseCase && (
      caseData.status === 'STATUS_20_IN_PROGRESS' ||
      caseData.status.includes('IN PROGRESS')
    ) && investigateTasks.length > 0 && investigateTasks.length === completedInvestigateTasks.length) {
      actions.push(
        <button
          key="close"
          onClick={() => onCloseCase(caseData)}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <XCircleIcon className="h-4 w-4" />
          Close Case
        </button>
      );
    }

    // Case Closure Decision button - show for cases pending final approval
    // if (showSupervisorControls &&
    //     onApproveCase &&
    //     (caseData.status === 'STATUS_22_PENDING_FINAL_APPROVAL' ||
    //       caseData.status.includes('PENDING FINAL APPROVAL'))) {
    //   actions.push(
    //     <button
    //       key="approve-closure"
    //       onClick={() => onApproveCase(caseData)}
    //       className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    //     >
    //       <CheckIcon className="h-4 w-4" />
    //       Review Case Closure
    //     </button>
    //   );
    // }

    // Approve Case Creation button - show for cases pending creation approval
    // if (showSupervisorControls &&
    //     onApproveCaseCreation &&
    //     (caseData.status === 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' ||
    //       caseData.status.includes('PENDING CASE CREATION APPROVAL'))) {
    //   actions.push(
    //     <button
    //       key="approve-creation"
    //       onClick={() => onApproveCaseCreation(caseData)}
    //       className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
    //     >
    //       <CheckIcon className="h-4 w-4" />
    //       Approve Case Creation
    //     </button>
    //   );
    // }

    // Reject Case Creation button - show for cases pending creation approval
    // if (showSupervisorControls &&
    //     onRejectCaseCreation &&
    //     (caseData.status === 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' ||
    //       caseData.status.includes('PENDING CASE CREATION APPROVAL'))) {
    //   actions.push(
    //     <button
    //       key="reject-creation"
    //       onClick={() => onRejectCaseCreation(caseData)}
    //       className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
    //     >
    //       <XCircleIcon className="h-4 w-4" />
    //       Reject Case Creation
    //     </button>
    //   );
    // }

    // Approve Case Reopening button - show for cases pending reopening approval
    if (showSupervisorControls &&
        onApproveCaseReopen &&
        (caseData.status === 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL' ||
          caseData.status.includes('PENDING CASE REOPENING APPROVAL'))) {
      actions.push(
        <button
          key="approve-reopen"
          onClick={() => onApproveCaseReopen(caseData)}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <CheckIcon className="h-4 w-4" />
          Approve Case Reopening
        </button>
      );
    }

    // Reject Case Reopening button - show for cases pending reopening approval
    if (showSupervisorControls &&
        onRejectCaseReopen &&
        (caseData.status === 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL' ||
          caseData.status.includes('PENDING CASE REOPENING APPROVAL'))) {
      actions.push(
        <button
          key="reject-reopen"
          onClick={() => onRejectCaseReopen(caseData)}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <XCircleIcon className="h-4 w-4" />
          Reject Case Reopening
        </button>
      );
    }

    // Reopen Case button - show for closed cases
    if (onReopenCase && (
      caseData.status === 'STATUS_81_CLOSED_REFUTED' ||
      caseData.status === 'STATUS_82_CLOSED_CONFIRMED' ||
      caseData.status === 'STATUS_83_CLOSED_INCONCLUSIVE' ||
      caseData.status.includes('CLOSED')
    )) {
      actions.push(
        <button
          key="reopen"
          onClick={() => onReopenCase(caseData)}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <PlayIcon className="h-4 w-4" />
          Reopen Case
        </button>
      );
    }

    // Abandon Case button - show for draft cases only
    if (onAbandonCase && (caseData.status === 'STATUS_00_DRAFT')) {
      actions.push(
        <button
          key="abandon"
          onClick={() => onAbandonCase(caseData)}
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <TrashIcon className="h-4 w-4" />
          Abandon Case
        </button>
      );
    }

    // Suspend Case button - show for in-progress cases
    if (onSuspendCase && (
      caseData.status === 'STATUS_20_IN_PROGRESS' ||
      caseData.status.includes('IN PROGRESS')
    ) && (caseData?.tasks && caseData.tasks.length > 0 && caseData.tasks.some((t) => t.status === 'STATUS_20_IN_PROGRESS'))) {
      actions.push(
        <button
          key="suspend"
          onClick={() => onSuspendCase(caseData)}
          className="inline-flex items-center gap-2 rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
        >
          <PauseIcon className="h-4 w-4" />
          Suspend Case
        </button>
      );
    }

    // Resume Case button - show for suspended cases
    if (onResumeCase && (
      caseData.status === 'STATUS_21_SUSPENDED' ||
      caseData.status.includes('SUSPENDED')
    )) {
      actions.push(
        <button
          key="resume"
          onClick={() => onResumeCase(caseData)}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <PlayIcon className="h-4 w-4" />
          Resume Case
        </button>
      );
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Available Actions</h3>
      </div>
      
      <div className="mt-4 flex flex-wrap gap-3">
        {availableActions}
      </div>
      
      <div className="mt-3 text-sm text-gray-500">
        Actions will be available based on your permissions and the case's current status.
      </div>
    </div>
  );
};

export default CaseActionsPanel;