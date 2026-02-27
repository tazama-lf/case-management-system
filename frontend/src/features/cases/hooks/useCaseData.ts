import { useState } from 'react';
import {
  caseService,
  type UpdateCaseDto,
  type AbandonCaseDto,
  type RejectCaseDto,
  type SuspendCaseDto,
  type ApproveCaseClosureDto,
  type ReturnCaseForReviewDto,
  type RejectCaseCreationDto,
} from '../services/caseService';
import type { CaseRow } from '../components/casesTable.utils';
import { transformBackendCaseToUI } from '../components/casesTable.utils';
import type { Priority, AlertType } from '../components/CreateCaseModal';
import { useAuth } from '../../auth/components/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useCaseData = () => {
  const { hasInvestigatorRole, hasSupervisorRole, hasAdminRole } = useAuth();

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const fetchCases = async (
    statusFilter?: string,
    priorityFilter?: string,
    sortBy?: 'recent' | 'oldest',
  ) => {
    setLoading(true);
    setErrorState(null);

    try {
      let response;

      const isInvestigatorOnly =
        hasInvestigatorRole() && !hasSupervisorRole() && !hasAdminRole();

      if (isInvestigatorOnly) {
        response = await caseService.getUserAssignedCases({
          status: statusFilter ?? undefined,
          priority: priorityFilter ?? undefined,
          includeTaskAssignments: true,
          includeOwnedCases: true,
          sortBy: 'updated_at',
          sortOrder: sortBy === 'recent' ? 'desc' : 'asc',
        });
      } else {
        response = await caseService.getAllCases({
          status: statusFilter ?? undefined,
          priority: priorityFilter ?? undefined,
          sortBy: 'updated_at',
          sortOrder: sortBy === 'recent' ? 'desc' : 'asc',
        });
      }

      const transformedCases = response.cases.map(transformBackendCaseToUI);
      setCases(transformedCases);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
      setErrorState('Failed to load cases. Please try again.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshCases = async (
    statusFilter?: string,
    priorityFilter?: string,
    sortBy?: 'recent' | 'oldest',
  ) => {
    try {
      const response = await caseService.getAllCases({
        status: statusFilter ?? undefined,
        priority: priorityFilter ?? undefined,
        sortBy: 'updated_at',
        sortOrder: sortBy === 'recent' ? 'desc' : 'asc',
      });
      setCases(response.cases.map(transformBackendCaseToUI));
    } catch (refreshError) {
      console.error('Failed to refresh cases:', refreshError);
    }
  };

  return {
    cases,
    setCases,
    loading,
    errorState,
    fetchCases,
    refreshCases,
  };
};

export const useCaseActions = (
  refreshCases: (
    statusFilter?: string,
    priorityFilter?: string,
    sortBy?: 'recent' | 'oldest',
  ) => Promise<void>,
) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [createCaseLoading, setCreateCaseLoading] = useState(false);
  const [createCaseError, setCreateCaseError] = useState<string>('');

  const handleCreate = async (payload: {
    alertId?: number;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }) => {
    setCreateCaseLoading(true);
    setCreateCaseError('');

    try {
      const manualCreateCaseData = {
        alertId: payload.alertId,
        priorityScore: payload.priorityScore,
        alertType: payload.alertType,
      };

      const newCase = await caseService.createCase(manualCreateCaseData);

      const alertInfo = payload.alertId
        ? `\nAssociated Alert ID: ${payload.alertId}\nAlert Type: ${payload.alertType}`
        : '';
      success(
        'Case Created',
        `Case ${newCase.case_id} created successfully with status: ${newCase.status}${alertInfo}`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error creating case:', err);
      setCreateCaseError(
        err instanceof Error ? err.message : 'Failed to create case',
      );
      error(
        'Create Case Failed',
        err instanceof Error ? err.message : 'Failed to create case',
      );
    } finally {
      setCreateCaseLoading(false);
    }
  };

  const handleUpdate = async (
    caseId: number,
    payload: {
      priority: Priority;
      priorityScore: number;
      alertType: AlertType;
      assignee?: string;
    },
  ) => {
    setCreateCaseLoading(true);
    setCreateCaseError('');

    try {
      const updateCaseData: UpdateCaseDto = {
        status: 'STATUS_02_READY_FOR_ASSIGNMENT',
        priority: payload.priority,
        caseType: payload.alertType,
        caseOwnerUserId: payload.assignee ?? user?.userId ?? 'system-user-id',
      };

      const updatedCase = await caseService.updateCase(caseId, updateCaseData);

      success(
        'Draft Case Completed',
        `Case ${updatedCase.case_id} completed successfully with status: ${updatedCase.status}\nPriority: ${payload.priority}\nType: ${payload.alertType}`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error updating case:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update case';
      setCreateCaseError(errorMessage);
      error('Update Case Failed', errorMessage);
    } finally {
      setCreateCaseLoading(false);
    }
  };

  const handleReopenSubmit = async (caseId: number, reason: string) => {
    try {
      const reopenCaseData = {
        reason: reason.trim(),
      };

      await caseService.reopenCase(caseId, reopenCaseData);

      success(
        'Case Reopened',
        `Case ${caseId} has been successfully reopened.`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error reopening case:', err);

      let errorMessage = 'Failed to request case reopening. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a reopenable state')) {
        errorMessage = `Case cannot be reopened.

This case may not meet the reopening requirements:
• Case must be in "CLOSED" status
• Case must not be already reopened

Please check the case status and try again.`;
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage = `Access Denied.

You don't have permission to reopen this case.
Please ensure you have the appropriate role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      }

      error('Reopen Case Failed', errorMessage);
    }
  };

  const handleAbandonSubmit = async (caseId: number, reason: string) => {
    try {
      const abandonCaseData: AbandonCaseDto = {
        reason: reason.trim(),
      };

      const abandonedCase = await caseService.abandonCase(
        caseId,
        abandonCaseData,
      );

      success(
        'Case Abandoned',
        `Case ${caseId} has been successfully abandoned.\nReason: ${reason}\nStatus: ${abandonedCase.status}`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error abandoning case:', err);

      let errorMessage = 'Failed to abandon case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('Cannot abandon case other than draft status')) {
        errorMessage =
          'Case cannot be abandoned.\n\n' +
          'This case may not meet the abandonment requirements:\n' +
          '• Case must be in "DRAFT" status\n' +
          '• Case must have a "Complete New Case" task\n\n' +
          'Please check the case status and try again.';
      } else if (errorString.includes('No complete new Case Task exists')) {
        errorMessage =
          'Case cannot be abandoned.\n\n' +
          'This case may not meet the abandonment requirements:\n' +
          '• Case must be in "DRAFT" status\n' +
          '• Case must have a "Complete New Case" task\n\n' +
          'Please check the case status and try again.';
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage =
          'Access Denied.\n\n' +
          'You don\'t have permission to abandon this case.\n' +
          'Please ensure you have the appropriate role.';
      } else if (errorString.includes('404')) {
        errorMessage =
          'Case Not Found.\n\n' + 'The case may have been deleted or moved.';
      }

      error('Abandon Case Failed', errorMessage);
    }
  };

  const handleSuspendSubmit = async (
    caseId: number,
    reason: string,
    tasksIds: number[],
  ) => {
    try {
      const suspendCaseData: SuspendCaseDto = {
        reason: reason.trim(),
        taskIds: tasksIds,
      };

      const suspendedCase = await caseService.suspendCase(
        caseId,
        suspendCaseData,
      );

      success(
        'Case Suspended',
        `Case ${caseId} has been successfully suspended.
Reason: ${reason}
Status: ${suspendedCase.status}

The case has been suspended and all associated tasks have been blocked. Supervisor has been notified of the suspension.`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error suspending case:', err);

      let errorMessage = 'Failed to suspend case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';
      const normalizedErrorString = (errorString || '')
        .replace(/"Investigate case"/gu, '"Investigate Case"')
        .replace(/\bcase\b/gu, 'Case');

      if (errorString.includes('not in a suspendable state')) {
        errorMessage =
          'Case cannot be suspended.\n\n' +
          'This case may not meet the suspension requirements:\n' +
          '• Case must be in "IN PROGRESS" status\n' +
          '• Case must not be already suspended or closed\n\n' +
          'Please check the case status and try again.';
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage =
          'Access Denied.\n\n' +
          'You don\'t have permission to suspend this case.\n' +
          'Please ensure you have the appropriate role.';
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      } else if (normalizedErrorString) {
        errorMessage = normalizedErrorString;
      }

      error('Suspend Case Failed', errorMessage);
    }
  };

  const handleResumeSubmit = async (caseId: number, reason: string) => {
    try {
      const resumeCaseData = {
        reason: reason.trim(),
      };

      const resumedCase = await caseService.resumeCase(caseId, resumeCaseData);

      success(
        'Case Resumed',
        `Case ${caseId} has been successfully resumed.
Reason: ${reason}
Status: ${resumedCase.status}

The case has been moved back to "In Progress" status. All associated tasks have been unblocked.`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error resuming case:', err);

      let errorMessage = 'Failed to resume case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a resumable state')) {
        errorMessage =
          `Case cannot be resumed.

` +
          `This case may not meet the resumption requirements:
` +
          `• Case must be in "SUSPENDED" status
` +
          `• Case must not be already closed or completed

` +
          'Please check the case status and try again.';
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage =
          `Access Denied.

` +
          `You don't have permission to resume this case.
` +
          'Please ensure you have the appropriate role.';
      } else if (errorString.includes('404')) {
        errorMessage =
          `Case Not Found.

` + 'The case may have been deleted or moved.';
      }

      error('Resume Case Failed', errorMessage);
    }
  };

  const handleRejectSubmit = async (
    rejectionReason: string,
    selectedRow: CaseRow | null,
  ) => {
    if (!selectedRow) return;

    try {
      const rejectCaseData: RejectCaseDto = {
        rejectionReason: rejectionReason.trim(),
      };

      const rejectedCase = await caseService.rejectCase(
        selectedRow.id,
        rejectCaseData,
      );

      success(
        'Case Closure Rejected',
        `Case ${selectedRow.id} closure has been successfully rejected.
Reason: ${rejectionReason}
Status: ${rejectedCase.status}

The case has been returned to the investigator for additional work.`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error rejecting case:', err);

      let errorMessage = 'Failed to reject case closure. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a rejectable state')) {
        errorMessage =
          `Case cannot be rejected.

` +
          `This case may not meet the rejection requirements:
` +
          `• Case must be pending final approval

` +
          'Please check the case status and try again.';
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage =
          `Access Denied.

` +
          `You don't have permission to reject this case.
` +
          'Please ensure you have the appropriate role.';
      } else if (errorString.includes('404')) {
        errorMessage =
          `Case Not Found.

` + 'The case may have been deleted or moved.';
      } else if (errorString.includes('Approval task validation failed')) {
        errorMessage = errorString;
      }

      error('Reject Case Failed', errorMessage);
    }
  };

  const handleApproveSubmit = async (
    data: ApproveCaseClosureDto,
    selectedRow: CaseRow | null,
  ) => {
    if (!selectedRow) return;

    try {
      const approvedCase = await caseService.approveCaseClosure(
        selectedRow.id,
        data,
      );

      success(
        'Case Closure Approved',
        `Case ${selectedRow.id} closure has been successfully approved.

Final Outcome: ${data.finalOutcome
          .replace('STATUS_', '')
          .replace(/_/gu, ' ')
          .replace(/\b\w/gu, (l: string) => l.toUpperCase())}
Status: ${approvedCase.status}

The case has been finalized with the selected outcome.`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error approving case:', err);

      let errorMessage = 'Failed to approve case closure. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in pending approval status')) {
        errorMessage = `Case cannot be approved.

This case may not meet the approval requirements:
• Case must be in "PENDING FINAL APPROVAL" status
• Case must have an "Approve case closure" task
• The "Approve case closure" task must be claimed by you

Please check the case status and try again.`;
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage = `Access Denied.

You don't have permission to approve this case closure.
Please ensure you have supervisor role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      } else if (errorString.includes('Approval task validation failed')) {
        errorMessage = `Approval Task Validation Failed.

The case may not have the required "Approve case closure" task,
or the task may not be in the correct state.

Please verify that:
• The case is in "PENDING FINAL APPROVAL" status
• An "Approve case closure" task exists for this case
• The "Approve case closure" task is claimed by you`;
      }

      error('Approve Case Failed', errorMessage);
    }
  };

  const handleApproveCreationSubmit = async (caseId: number) => {
    try {
      const approvedCase = await caseService.approveCaseCreation(caseId);

      success(
        'Case Creation Approved',
        `Case ${caseId} creation has been successfully approved.

Status: ${approvedCase.status}

The case has been moved to "READY FOR ASSIGNMENT" status. An "Investigate Case" task has been created in the Flowable investigations queue.`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error approving case creation:', err);

      let errorMessage = 'Failed to approve case creation. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in PENDING_CASE_CREATION_APPROVAL state')) {
        errorMessage = `Case cannot be approved.

This case may not meet the approval requirements:
• Case must be in "PENDING CASE CREATION APPROVAL" status
• Case must have an "Approve Case Creation" task

Please check the case status and try again.`;
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage = `Access Denied.

You don't have permission to approve this case creation.
Please ensure you have supervisor role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      }

      error('Approve Case Creation Failed', errorMessage);
    }
  };

  const handleRejectCreationSubmit = async (
    caseId: number,
    data: RejectCaseCreationDto,
  ) => {
    try {
      const rejectedCase = await caseService.rejectCaseCreation(caseId, data);

      success(
        'Case Creation Rejected',
        `Case ${caseId} creation has been successfully rejected.

Reason: ${data.reason}
Status: ${rejectedCase.status}

The case has been returned to "DRAFT" status. A "Complete New Case" task has been assigned to the original creator.`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error rejecting case creation:', err);

      let errorMessage = 'Failed to reject case creation. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in PENDING_CASE_CREATION_APPROVAL state')) {
        errorMessage = `Case cannot be rejected.

This case may not meet the rejection requirements:
• Case must be in "PENDING CASE CREATION APPROVAL" status
• Case must have an "Approve Case Creation" task

Please check the case status and try again.`;
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage = `Access Denied.

You don't have permission to reject this case creation.
Please ensure you have supervisor role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      }

      error('Reject Case Creation Failed', errorMessage);
    }
  };

  const handleReturnForReviewSubmit = async (
    caseId: number,
    data: ReturnCaseForReviewDto,
  ) => {
    try {
      const returnedCase = await caseService.returnCaseForReview(caseId, data);

      success(
        'Case Returned for Review',
        `Case ${caseId} has been successfully returned for additional review.

Review Comments: ${data.reviewComments}
Status: ${returnedCase.status}

The case has been returned to the investigator for additional work.`,
      );

      await refreshCases();
    } catch (err) {
      console.error('Error returning case for review:', err);

      let errorMessage = 'Failed to return case for review. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in pending approval status')) {
        errorMessage = `Case cannot be returned.

This case may not meet the return requirements:
• Case must be in "PENDING FINAL APPROVAL" status
• Case must have an "Approve case closure" task

Please check the case status and try again.`;
      } else if (
        errorString.includes('Unauthorized') ||
        errorString.includes('403')
      ) {
        errorMessage = `Access Denied.

You don't have permission to return this case for review.
Please ensure you have supervisor role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      } else if (errorString.includes('Approval task validation failed')) {
        errorMessage = `Approval Task Validation Failed.

The case may not have the required "Approve case closure" task,
or the task may not be in the correct state.

Please verify that:
• The case is in "PENDING FINAL APPROVAL" status
• An "Approve case closure" task exists for this case
• The "Approve case closure" task is claimed by you`;
      }

      error('Return Case for Review Failed', errorMessage);
    }
  };

  return {
    createCaseLoading,
    createCaseError,
    setCreateCaseError,
    handleCreate,
    handleUpdate,
    handleReopenSubmit,
    handleAbandonSubmit,
    handleSuspendSubmit,
    handleResumeSubmit,
    handleRejectSubmit,
    handleApproveSubmit,
    handleApproveCreationSubmit,
    handleRejectCreationSubmit,
    handleReturnForReviewSubmit,
  };
};
