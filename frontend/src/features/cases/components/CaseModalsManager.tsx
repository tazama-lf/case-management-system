import React, { Suspense, lazy } from 'react';
import { CreateCaseModal, ViewCaseModal } from '..';
import { 
  caseService,
  type CloseCaseDto,
  type ApproveCaseClosureDto,
  type RejectCaseCreationDto,
  type ReturnCaseForReviewDto
} from '@/features/cases/services/caseService';
import type { CaseRow } from '@/features/cases/components/CasesTable';
import type { Priority, AlertType } from '@/features/cases/components/CreateCaseModal';
import { useToast } from '@/shared/providers/ToastProvider';
import { useDynamicRoute } from '@/shared/utils/routeUtils';

// Dynamic imports for modals
const CloseCaseModal = lazy(() => import('@/features/cases/components/CloseCaseModal'));
const ApproveCaseReopenModal = lazy(() => import('@/features/cases/components/ApproveCaseReopenModal'));
const RejectCaseReopenModal = lazy(() => import('@/features/cases/components/RejectCaseReopenModal'));
const ReopenCaseModal = lazy(() => import('@/features/cases/components/ReopenCaseModal'));
const AbandonCaseModal = lazy(() => import('@/features/cases/components/AbandonCaseModal'));
const SuspendCaseModal = lazy(() => import('@/features/cases/components/SuspendCaseModal'));
const ResumeCaseModal = lazy(() => import('@/features/cases/components/ResumeCaseModal'));
const RejectCaseModal = lazy(() => import('@/features/cases/components/RejectCaseModal'));
const ApproveCaseModal = lazy(() => import('@/features/cases/components/ApproveCaseModal'));
const ApproveCaseCreationModal = lazy(() => import('@/features/cases/components/ApproveCaseCreationModal'));
const RejectCaseCreationModal = lazy(() => import('@/features/cases/components/RejectCaseCreationModal'));
const ReturnCaseForReviewModal = lazy(() => import('@/features/cases/components/ReturnCaseForReviewModal'));

export interface CaseModalState {
  isCreateOpen: boolean;
  isViewOpen: boolean;
  isCloseCaseOpen: boolean;
  isReopenOpen: boolean;
  isAbandonOpen: boolean;
  isSuspendOpen: boolean;
  isResumeOpen: boolean;
  isRejectOpen: boolean;
  isApproveOpen: boolean;
  isApproveCreationOpen: boolean;
  isRejectCreationOpen: boolean;
  isReturnForReviewOpen: boolean;
  isApproveReopenOpen: boolean;
  isRejectReopenOpen: boolean;
  selectedRow: CaseRow | null;
  createModalMode: 'create' | 'edit';
  editingCaseId: string | null;
  createCaseLoading: boolean;
  createCaseError: string;
}

export interface CaseModalActions {
  setIsCreateOpen: (open: boolean) => void;
  setIsViewOpen: (open: boolean) => void;
  setIsCloseCaseOpen: (open: boolean) => void;
  setIsReopenOpen: (open: boolean) => void;
  setIsAbandonOpen: (open: boolean) => void;
  setIsSuspendOpen: (open: boolean) => void;
  setIsResumeOpen: (open: boolean) => void;
  setIsRejectOpen: (open: boolean) => void;
  setIsApproveOpen: (open: boolean) => void;
  setIsApproveCreationOpen: (open: boolean) => void;
  setIsRejectCreationOpen: (open: boolean) => void;
  setIsReturnForReviewOpen: (open: boolean) => void;
  setIsApproveReopenOpen: (open: boolean) => void;
  setIsRejectReopenOpen: (open: boolean) => void;
  setSelectedRow: (row: CaseRow | null) => void;
  setCreateModalMode: (mode: 'create' | 'edit') => void;
  setEditingCaseId: (id: string | null) => void;
  setCreateCaseLoading: (loading: boolean) => void;
  setCreateCaseError: (error: string) => void;
}

interface CaseModalsManagerProps {
  modalState: CaseModalState;
  modalActions: CaseModalActions;
  onRefreshCases: () => Promise<void>;
  caseActions: {
    handleCloseCaseSubmit: (caseId: string, data: CloseCaseDto) => Promise<void>;
    handleAbandonSubmit: (caseId: string, reason: string) => Promise<void>;
    handleSuspendSubmit: (caseId: string, reason: string) => Promise<void>;
    handleResumeSubmit: (caseId: string, reason: string) => Promise<void>;
    handleApproveClosureSubmit: (caseId: string, finalOutcome: "STATUS_81_CLOSED_REFUTED" | "STATUS_82_CLOSED_CONFIRMED" | "STATUS_83_CLOSED_INCONCLUSIVE", supervisorComments?: string) => Promise<void>;
    handleApproveCreation: (caseId: string) => Promise<void>;
    handleRejectCaseCreation: (caseId: string, reason: string) => Promise<void>;
    handleRejectCase: (caseId: string, reason: string) => Promise<void>;
    handleReturnForReview: (caseId: string, reviewComments: string) => Promise<void>;
    handleReopenSubmit: (caseId: string, reason: string) => Promise<void>;
  };
}

const CaseModalsManager: React.FC<CaseModalsManagerProps> = ({
  modalState,
  modalActions,
  onRefreshCases,
  caseActions
}) => {
  const { success, error } = useToast();
  const { params, navigate } = useDynamicRoute();

  const handleCreate = async (payload: {
    alertId?: string;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }) => {
    modalActions.setCreateCaseLoading(true);
    modalActions.setCreateCaseError('');

    try {
      const manualCreateCaseData = {
        alertId: payload.alertId,
        priorityScore: payload.priorityScore,
        alertType: payload.alertType,
      };

      const newCase = await caseService.createCase(manualCreateCaseData);

      const alertInfo = payload.alertId ? `\nAssociated Alert ID: ${payload.alertId}\nAlert Type: ${payload.alertType}` : '';
      success('Case Created', `Case ${newCase.case_id} created successfully with status: ${newCase.status}${alertInfo}`);

      modalActions.setIsCreateOpen(false);
      await onRefreshCases();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create case';
      modalActions.setCreateCaseError(errorMessage);
      error('Create Case Failed', errorMessage);
    } finally {
      modalActions.setCreateCaseLoading(false);
    }
  };

  const handleUpdate = async (caseId: string, payload: {
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
  }) => {
    modalActions.setCreateCaseLoading(true);
    modalActions.setCreateCaseError('');

    try {
      const updateCaseData = {
        status: 'STATUS_02_READY_FOR_ASSIGNMENT' as const,
        priority: payload.priority,
        caseType: payload.alertType,
        ...(payload.assignee && { caseOwnerUserId: payload.assignee }),
      };

      const updatedCase = await caseService.updateCase(caseId, updateCaseData);

      success('Draft Case Completed', `Case ${updatedCase.case_id} completed successfully with status: ${updatedCase.status}\nPriority: ${payload.priority}\nType: ${payload.alertType}`);

      modalActions.setIsCreateOpen(false);
      modalActions.setCreateModalMode('create');
      modalActions.setEditingCaseId(null);

      await onRefreshCases();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update case';
      modalActions.setCreateCaseError(errorMessage);
      error('Update Case Failed', errorMessage);
    } finally {
      modalActions.setCreateCaseLoading(false);
    }
  };

  const handleCloseCaseSubmit = async (data: CloseCaseDto) => {
    if (!modalState.selectedRow) return;
    await caseActions.handleCloseCaseSubmit(modalState.selectedRow.id, data);
    modalActions.setIsCloseCaseOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleReopenSubmit = async (caseId: string, reason: string) => {
    await caseActions.handleReopenSubmit(caseId, reason);
    modalActions.setIsReopenOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleAbandonSubmit = async (caseId: string, reason: string) => {
    await caseActions.handleAbandonSubmit(caseId, reason);
    modalActions.setIsAbandonOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleSuspendSubmit = async (caseId: string, reason: string) => {
    await caseActions.handleSuspendSubmit(caseId, reason);
    modalActions.setIsSuspendOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleResumeSubmit = async (caseId: string, reason: string) => {
    await caseActions.handleResumeSubmit(caseId, reason);
    modalActions.setIsResumeOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleRejectSubmit = async (rejectionReason: string) => {
    if (!modalState.selectedRow) return;
    await caseActions.handleRejectCase(modalState.selectedRow.id, rejectionReason);
    modalActions.setIsRejectOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleApproveSubmit = async (data: ApproveCaseClosureDto) => {
    if (!modalState.selectedRow) return;
    
    const finalOutcome = data.finalOutcome as "STATUS_81_CLOSED_REFUTED" | "STATUS_82_CLOSED_CONFIRMED" | "STATUS_83_CLOSED_INCONCLUSIVE";
    await caseActions.handleApproveClosureSubmit(
      modalState.selectedRow.id, 
      finalOutcome,
      data.supervisorComments
    );
    modalActions.setIsApproveOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleApproveCreationSubmit = async (caseId: string) => {
    await caseActions.handleApproveCreation(caseId);
    modalActions.setIsApproveCreationOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleRejectCreationSubmit = async (caseId: string, data: RejectCaseCreationDto) => {
    await caseActions.handleRejectCaseCreation(caseId, data.reason);
    modalActions.setIsRejectCreationOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleReturnForReviewSubmit = async (caseId: string, data: ReturnCaseForReviewDto) => {
    if (!modalState.selectedRow) return;
    await caseActions.handleReturnForReview(caseId, data.reviewComments);
    modalActions.setIsReturnForReviewOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleApproveReopenSubmit = async (caseId: string, comments?: string) => {
    try {
      const resp = await caseService.approveCaseReopening(caseId);

      const updatedStatus = resp.case?.status;
      let outcomeDetails = '';
      if (updatedStatus === 'STATUS_10_ASSIGNED') {
        const assignedTo = resp.investigation_task?.assigned_to ? ` and assigned to ${resp.investigation_task.assigned_to}` : '';
        outcomeDetails = `\n\nStatus: STATUS_10_ASSIGNED\nAn "Investigate Case" task (${resp.investigation_task?.task_id || 'N/A'}) has been created${assignedTo}.`;
      } else if (updatedStatus === 'STATUS_02_READY_FOR_ASSIGNMENT') {
        const candidateGroup = resp.investigation_task?.candidateGroup || 'Investigations';
        outcomeDetails = `\n\nStatus: STATUS_02_READY_FOR_ASSIGNMENT\nAn "Investigate Case" task (${resp.investigation_task?.task_id || 'N/A'}) has been created in the ${candidateGroup} queue.`;
      } else if (updatedStatus === 'STATUS_31_REOPENED') {
        outcomeDetails = `\n\nStatus: STATUS_31_REOPENED\nAn "Investigate Case" task has been created.`;
      }

      const commentsMessage = comments ? `\n\nApprover Comments: ${comments}` : '';
      success('Case Reopening Approved', `Case ${caseId} reopening has been approved.${outcomeDetails}${commentsMessage}`);
      modalActions.setIsApproveReopenOpen(false);
      modalActions.setSelectedRow(null);

      await onRefreshCases();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve case reopening';
      error('Approve Case Reopening Failed', message);
    }
  };

  const handleRejectReopenSubmit = async (caseId: string, reason: string) => {
    try {
      const resp = await caseService.rejectCaseReopening(caseId, reason);

      let outcomeDetails = `\n\nReason: ${resp.rejection_reason || reason}`;
      const status = resp.case?.status;
      if (status?.startsWith('STATUS_8') || status?.startsWith('STATUS_7')) {
        outcomeDetails += `\nStatus: ${status}\nThe case remains closed.`;
      }

      success('Case Reopening Rejected', `Case ${caseId} reopening has been rejected.${outcomeDetails}`);
      modalActions.setIsRejectReopenOpen(false);
      modalActions.setSelectedRow(null);

      await onRefreshCases();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject case reopening';
      error('Reject Case Reopening Failed', message);
    }
  };

  return (
    <>
      <CreateCaseModal
        open={modalState.isCreateOpen}
        onClose={() => {
          modalActions.setIsCreateOpen(false);
          modalActions.setCreateCaseError('');
          modalActions.setCreateModalMode('create');
          modalActions.setEditingCaseId(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        loading={modalState.createCaseLoading}
        error={modalState.createCaseError}
        mode={modalState.createModalMode}
        existingCaseId={modalState.editingCaseId || undefined}
        initial={modalState.selectedRow ? {
          alertId: modalState.selectedRow.alertId,
          alertType: ((): AlertType => {
            const t = (modalState.selectedRow.type || '').toUpperCase();
            if (t.includes('FRAUD') && t.includes('AML')) return 'FRAUD_AND_AML';
            if (t.includes('FRAUD')) return 'FRAUD';
            if (t.includes('AML')) return 'AML';
            return 'NONE';
          })(),
          priority: (modalState.selectedRow.priority?.toUpperCase() as Priority) || 'NEW',
          priorityScore: 0.33
        } : undefined}
      />

      <ViewCaseModal
        open={modalState.isViewOpen}
        onClose={() => {
          modalActions.setIsViewOpen(false);
          modalActions.setSelectedRow(null);
          // Clear case ID from URL when closing modal
          if (params.caseId) {
            navigate('/cases');
          }
        }}
        row={modalState.selectedRow}
      />

      <Suspense fallback={<div>Loading modal...</div>}>
        <CloseCaseModal
          open={modalState.isCloseCaseOpen}
          onClose={() => modalActions.setIsCloseCaseOpen(false)}
          caseId={modalState.selectedRow?.id || ''}
          caseName={modalState.selectedRow ? `${modalState.selectedRow.type} Case` : ''}
          onSubmit={handleCloseCaseSubmit}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ReopenCaseModal
          open={modalState.isReopenOpen}
          onClose={() => modalActions.setIsReopenOpen(false)}
          onReopen={handleReopenSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <AbandonCaseModal
          open={modalState.isAbandonOpen}
          onClose={() => modalActions.setIsAbandonOpen(false)}
          onAbandon={handleAbandonSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <SuspendCaseModal
          open={modalState.isSuspendOpen}
          onClose={() => modalActions.setIsSuspendOpen(false)}
          onSuspend={handleSuspendSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ResumeCaseModal
          open={modalState.isResumeOpen}
          onClose={() => modalActions.setIsResumeOpen(false)}
          onResume={handleResumeSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <RejectCaseModal
          open={modalState.isRejectOpen}
          onClose={() => modalActions.setIsRejectOpen(false)}
          caseId={modalState.selectedRow?.id || ''}
          caseName={modalState.selectedRow ? `${modalState.selectedRow.type} Case` : ''}
          onSubmit={handleRejectSubmit}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ApproveCaseModal
          open={modalState.isApproveOpen}
          onClose={() => modalActions.setIsApproveOpen(false)}
          caseId={modalState.selectedRow?.id || ''}
          caseName={modalState.selectedRow ? `${modalState.selectedRow.type} Case` : ''}
          recommendedOutcome={modalState.selectedRow?.status || ''}
          onSubmit={handleApproveSubmit}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ApproveCaseCreationModal
          open={modalState.isApproveCreationOpen}
          onClose={() => modalActions.setIsApproveCreationOpen(false)}
          caseData={modalState.selectedRow}
          onSubmit={(caseId) => handleApproveCreationSubmit(caseId)}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <RejectCaseCreationModal
          open={modalState.isRejectCreationOpen}
          onClose={() => modalActions.setIsRejectCreationOpen(false)}
          caseData={modalState.selectedRow}
          onSubmit={(caseId, data) => handleRejectCreationSubmit(caseId, data)}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ReturnCaseForReviewModal
          open={modalState.isReturnForReviewOpen}
          onClose={() => modalActions.setIsReturnForReviewOpen(false)}
          caseData={modalState.selectedRow}
          onSubmit={(caseId, data) => handleReturnForReviewSubmit(caseId, data)}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ApproveCaseReopenModal
          open={modalState.isApproveReopenOpen}
          onClose={() => modalActions.setIsApproveReopenOpen(false)}
          caseId={modalState.selectedRow?.id || ''}
          requesterRole={undefined}
          onApprove={handleApproveReopenSubmit}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <RejectCaseReopenModal
          open={modalState.isRejectReopenOpen}
          onClose={() => modalActions.setIsRejectReopenOpen(false)}
          caseId={modalState.selectedRow?.id || ''}
          onReject={handleRejectReopenSubmit}
        />
      </Suspense>
    </>
  );
};

export default CaseModalsManager;