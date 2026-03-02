import React, { Suspense, lazy } from 'react';
import { CreateCaseModal, ViewCaseModal } from '..';
import {
  caseService,
  type CloseCaseDto,
  type ApproveCaseClosureDto,
  type RejectCaseCreationDto,
} from '@/features/cases/services/caseService';
import type { CaseRow } from '@/features/cases/components/casesTable.utils';
import type {
  Priority,
  AlertType,
  CaseStatus,
  PredictionOutcome,
} from '@/features/cases/components/CreateCaseModal';
import { useToast } from '@/shared/providers/ToastProvider';
import { useDynamicRoute } from '@/shared/utils/routeUtils';
import {
  convertToTriageAlert,
  ManualTriageModal,
  transformBackendAlertToUI,
  triageService,
  type Alert,
} from '@/features/alerts';
import type { ManualTriageDto } from '@/features/alerts/types/triage.types';
import { useAlertOperations } from '@/features/alerts/hooks/useAlertsQuery';
// Dynamic imports for modals
const CloseCaseModal = lazy(
  async () => await import('@/features/cases/components/CloseCaseModal'),
);
const ApproveCaseReopenModal = lazy(
  async () =>
    await import('@/features/cases/components/ApproveCaseReopenModal'),
);
const RejectCaseReopenModal = lazy(
  async () => await import('@/features/cases/components/RejectCaseReopenModal'),
);
const ReopenCaseModal = lazy(
  async () => await import('@/features/cases/components/ReopenCaseModal'),
);
const AbandonCaseModal = lazy(
  async () => await import('@/features/cases/components/AbandonCaseModal'),
);
const SuspendCaseModal = lazy(
  async () => await import('@/features/cases/components/SuspendCaseModal'),
);
const ResumeCaseModal = lazy(
  async () => await import('@/features/cases/components/ResumeCaseModal'),
);
const ApproveCaseCreationModal = lazy(
  async () =>
    await import('@/features/cases/components/ApproveCaseCreationModal'),
);
const RejectCaseCreationModal = lazy(
  async () =>
    await import('@/features/cases/components/RejectCaseCreationModal'),
);
const CaseClosureDecisionModal = lazy(
  async () =>
    await import('@/features/cases/components/CaseClosureDecisionModal'),
);

export interface CaseModalState {
  isCreateOpen: boolean;
  isUpdateAlertOpen: boolean;
  isViewOpen: boolean;
  isCloseCaseOpen: boolean;
  isReopenOpen: boolean;
  isAbandonOpen: boolean;
  isSuspendOpen: boolean;
  isResumeOpen: boolean;
  isCaseClosureDecisionOpen: boolean;
  isApproveCreationOpen: boolean;
  isRejectCreationOpen: boolean;
  isApproveReopenOpen: boolean;
  isRejectReopenOpen: boolean;
  selectedRow: CaseRow | null;
  createModalMode: 'create' | 'edit';
  editingCaseId: number | null;
  createCaseLoading: boolean;
  createCaseError: string;
}

export interface CaseModalActions {
  setIsCreateOpen: (open: boolean) => void;
  setIsUpdateAlertOpen: (open: boolean) => void;
  setIsViewOpen: (open: boolean) => void;
  setIsCloseCaseOpen: (open: boolean) => void;
  setIsReopenOpen: (open: boolean) => void;
  setIsAbandonOpen: (open: boolean) => void;
  setIsSuspendOpen: (open: boolean) => void;
  setIsResumeOpen: (open: boolean) => void;
  setIsCaseClosureDecisionOpen: (open: boolean) => void;
  setIsApproveCreationOpen: (open: boolean) => void;
  setIsRejectCreationOpen: (open: boolean) => void;
  setIsApproveReopenOpen: (open: boolean) => void;
  setIsRejectReopenOpen: (open: boolean) => void;
  setSelectedRow: (row: CaseRow | null) => void;
  setCreateModalMode: (mode: 'create' | 'edit') => void;
  setEditingCaseId: (id: number | null) => void;
  setCreateCaseLoading: (loading: boolean) => void;
  setCreateCaseError: (error: string) => void;
}

interface CaseModalsManagerProps {
  modalState: CaseModalState;
  modalActions: CaseModalActions;
  onRefreshCases: () => Promise<void>;
  permissions: {
    canManageSupervisorActions: boolean;
    isInvestigatorOnly: boolean;
  };
  caseActions: {
    handleCloseCaseSubmit: (
      caseId: number,
      data: CloseCaseDto,
    ) => Promise<void>;
    handleAbandonSubmit: (caseId: number, reason: string) => Promise<void>;
    handleSuspendSubmit: (
      caseId: number,
      reason: string,
      taskIds: number[],
    ) => Promise<void>;
    handleResumeSubmit: (caseId: number, reason: string) => Promise<void>;
    handleApproveClosureSubmit: (
      caseId: number,
      finalOutcome:
        | 'STATUS_81_CLOSED_REFUTED'
        | 'STATUS_82_CLOSED_CONFIRMED'
        | 'STATUS_83_CLOSED_INCONCLUSIVE',
      supervisorComments?: string,
    ) => Promise<void>;
    handleApproveCreation: (caseId: number) => Promise<void>;
    handleRejectCaseCreation: (caseId: number, reason: string) => Promise<void>;
    handleRejectCase: (caseId: number, reason: string) => Promise<void>;
    handleReopenSubmit: (caseId: number, reason: string) => Promise<void>;
  };
}

const CaseModalsManager: React.FC<CaseModalsManagerProps> = ({
  modalState,
  modalActions,
  onRefreshCases,
  permissions,
  caseActions,
}) => {
  const [selectedAlert, setSelectedAlert] = React.useState<Alert | null>(null);
  const { performManualTriage } = useAlertOperations();
  const { success, error } = useToast();
  const { params, navigate } = useDynamicRoute();
  const closeViewCaseModal = (): void => {
    modalActions.setIsViewOpen(false);
    modalActions.setSelectedRow(null);

    if (typeof params === 'object' && params && 'caseId' in params && params.caseId) {
      navigate('/cases');
    }
  };
  const [subCasesDetails, setSubCasesDetails] = React.useState<CaseRow[]>();

  const handleManualTriage = async (
    alert: Alert,
    triageData: ManualTriageDto,
  ): Promise<void> => {
    try {
      await performManualTriage({
        alertId: alert.alert_id,
        data: triageData,
      });
      // Close modal immediately
      setSelectedAlert(null);
      modalActions.setIsUpdateAlertOpen(false);
      success(
        'Manual Triage Completed',
        'The alert has been triaged successfully.',
      );
      // Brief delay to ensure backend has processed the triage and created new tasks
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh tasks to show updated "Complete New Case" status and new "Investigate" task
      if (onRefreshCases) {
        await onRefreshCases();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to perform triage. Please try again.';
      error('Triage Failed', errorMessage);
      throw error;
    }
  };

  const handleCreate = async (payload: {
    alertId?: number;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }): Promise<void> => {
    modalActions.setCreateCaseLoading(true);
    modalActions.setCreateCaseError('');

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

      modalActions.setIsCreateOpen(false);
      await onRefreshCases();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create case';
      modalActions.setCreateCaseError(errorMessage);
      error('Create Case Failed', errorMessage);
    } finally {
      modalActions.setCreateCaseLoading(false);
    }
  };
  const handleSaveDraft = async (payload: {
    alertId?: number;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }): Promise<void> => {
    modalActions.setCreateCaseLoading(true);
    modalActions.setCreateCaseError('');

    try {
      const manualCreateCaseData = {
        alertId: payload.alertId,
        priorityScore: payload.priorityScore,
        alertType: payload.alertType,
      };

      const newCase = await caseService.SaveCaseAsDraft(manualCreateCaseData);

      const alertInfo = payload.alertId
        ? `\nAssociated Alert ID: ${payload.alertId}\nAlert Type: ${payload.alertType}`
        : '';
      success(
        'Case Created',
        `Case ${newCase.case_id} created successfully with status: ${newCase.status}${alertInfo}`,
      );

      modalActions.setIsCreateOpen(false);
      await onRefreshCases();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create case';
      modalActions.setCreateCaseError(errorMessage);
      error('Create Case Failed', errorMessage);
    } finally {
      modalActions.setCreateCaseLoading(false);
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
  ): Promise<void> => {
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

      success(
        'Draft Case Completed',
        `Case ${updatedCase.case_id} completed successfully with status: ${updatedCase.status}\nPriority: ${payload.priority}\nType: ${payload.alertType}`,
      );

      modalActions.setIsCreateOpen(false);
      modalActions.setCreateModalMode('create');
      modalActions.setEditingCaseId(null);

      await onRefreshCases();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update case';
      modalActions.setCreateCaseError(errorMessage);
      error('Update Case Failed', errorMessage);
    } finally {
      modalActions.setCreateCaseLoading(false);
    }
  };
  const handleCompleteCase = async (
    caseId: number,
    payload: {
      priority: Priority;
      priorityScore: number;
      alertType: AlertType;
      assignee?: string;
      status: CaseStatus;
      confidence: number;
      predictionOutcome?: PredictionOutcome;
      note: string;
    },
  ): Promise<void> => {
    modalActions.setCreateCaseLoading(true);
    modalActions.setCreateCaseError('');

    try {
      const updateCaseData = {
        priority: payload.priority,
        caseType: payload.alertType,
        confidence: payload.confidence,
        predictionOutcome: payload.predictionOutcome,
        note: payload.note,
        status: payload.status,
        priorityScore: payload.priorityScore,
        ...(payload.assignee && { caseOwnerUserId: payload.assignee }),
      };

      const updatedCase = await caseService.completeCase(
        caseId,
        updateCaseData,
      );

      success(
        'Draft Case Completed',
        `Case ${updatedCase.case_id} completed successfully with status: ${updatedCase.status}\nPriority: ${payload.priority}\nType: ${payload.alertType}`,
      );

      modalActions.setIsCreateOpen(false);
      modalActions.setCreateModalMode('create');
      modalActions.setEditingCaseId(null);

      await onRefreshCases();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to update case';
      modalActions.setCreateCaseError(errorMessage);
      error('Update Case Failed', errorMessage);
    } finally {
      modalActions.setCreateCaseLoading(false);
    }
  };

  const handleCloseCaseSubmit = async (data: CloseCaseDto): Promise<void> => {
    if (!modalState.selectedRow) return;
    await caseActions.handleCloseCaseSubmit(modalState.selectedRow.id, data);
    modalActions.setIsCloseCaseOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleReopenSubmit = async (caseId: number, reason: string): Promise<void> => {
    await caseActions.handleReopenSubmit(caseId, reason);
    modalActions.setIsReopenOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleAbandonSubmit = async (caseId: number, reason: string): Promise<void> => {
    await caseActions.handleAbandonSubmit(caseId, reason);
    modalActions.setIsAbandonOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleSuspendSubmit = async (
    caseId: number,
    reason: string,
    taskIds: number[],
  ): Promise<void> => {
    await caseActions.handleSuspendSubmit(caseId, reason, taskIds);
    modalActions.setIsSuspendOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleResumeSubmit = async (caseId: number, reason: string): Promise<void> => {
    await caseActions.handleResumeSubmit(caseId, reason);
    modalActions.setIsResumeOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleRejectSubmit = async (rejectionReason: string): Promise<void> => {
    if (!modalState.selectedRow) return;
    await caseActions.handleRejectCase(
      modalState.selectedRow.id,
      rejectionReason,
    );
    modalActions.setIsCaseClosureDecisionOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleApproveSubmit = async (data: ApproveCaseClosureDto): Promise<void> => {
    if (!modalState.selectedRow) return;

    const { finalOutcome } = data;
    await caseActions.handleApproveClosureSubmit(
      modalState.selectedRow.id,
      finalOutcome,
      data.supervisorComments,
    );
    modalActions.setIsCaseClosureDecisionOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleApproveCreationSubmit = async (caseId: number): Promise<void> => {
    await caseActions.handleApproveCreation(caseId);
    modalActions.setIsApproveCreationOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleRejectCreationSubmit = async (
    caseId: number,
    data: RejectCaseCreationDto,
  ): Promise<void> => {
    await caseActions.handleRejectCaseCreation(caseId, data.reason);
    modalActions.setIsRejectCreationOpen(false);
    modalActions.setSelectedRow(null);
  };

  const handleApproveReopenSubmit = async (
    caseId: number,
    comments?: string,
  ): Promise<void> => {
    try {
      const resp = await caseService.approveCaseReopening(caseId);

      const updatedStatus = resp.case?.status;
      let outcomeDetails = '';
      if (updatedStatus === 'STATUS_10_ASSIGNED') {
        const assignedTo = resp.investigation_task?.assigned_to
          ? ` and assigned to ${resp.investigation_task.assigned_to}`
          : '';
        outcomeDetails = `\n\nStatus: STATUS_10_ASSIGNED\nAn "Investigate Case" task (${resp.investigation_task?.task_id ?? 'N/A'}) has been created${assignedTo}.`;
      } else if (updatedStatus === 'STATUS_02_READY_FOR_ASSIGNMENT') {
        const candidateGroup =
          resp.investigation_task?.candidateGroup ?? 'Investigations';
        outcomeDetails = `\n\nStatus: STATUS_02_READY_FOR_ASSIGNMENT\nAn "Investigate Case" task (${resp.investigation_task?.task_id ?? 'N/A'}) has been created in the ${candidateGroup} queue.`;
      } else if (updatedStatus === 'STATUS_31_REOPENED') {
        outcomeDetails =
          '\n\nStatus: STATUS_31_REOPENED\nAn "Investigate Case" task has been created.';
      }

      const commentsMessage = comments
        ? `\n\nApprover Comments: ${comments}`
        : '';
      success(
        'Case Reopening Approved',
        `Case ${caseId} reopening has been approved.${outcomeDetails}${commentsMessage}`,
      );
      modalActions.setIsApproveReopenOpen(false);
      modalActions.setSelectedRow(null);

      await onRefreshCases();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to approve case reopening';
      error('Approve Case Reopening Failed', message);
    }
  };

  const openTriageModal = async (): Promise<void> => {
    try {
      if (!modalState.selectedRow?.alertId) return;

      const alertDetails = await triageService.getAlertById(
        modalState.selectedRow.alertId,
      );
      const transformed = transformBackendAlertToUI(alertDetails);
      setSelectedAlert(transformed);
    } catch (error) {
      console.error('Failed to load alert for triage:', error);
      modalActions.setIsUpdateAlertOpen(false);
    }
  };

  const handleRejectReopenSubmit = async (caseId: number, reason: string): Promise<void> => {
    try {
      const resp = await caseService.rejectCaseReopening(caseId, reason);

      let outcomeDetails = `\n\nReason: ${resp.rejection_reason ?? reason}`;
      const status = resp.case?.status;
      if (status?.startsWith('STATUS_8') || status?.startsWith('STATUS_7')) {
        outcomeDetails += `\nStatus: ${status}\nThe case remains closed.`;
      }

      success(
        'Case Reopening Rejected',
        `Case ${caseId} reopening has been rejected.${outcomeDetails}`,
      );
      modalActions.setIsRejectReopenOpen(false);
      modalActions.setSelectedRow(null);

      await onRefreshCases();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to reject case reopening';
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
        onCompleteCase={handleCompleteCase}
        onCreate={handleCreate}
        onSaveDraft={handleSaveDraft}
        onUpdate={handleUpdate}
        loading={modalState.createCaseLoading}
        error={modalState.createCaseError}
        mode={modalState.createModalMode}
        existingCaseId={modalState.editingCaseId ?? undefined}
        initial={
          modalState.selectedRow
            ? {
                alertId: modalState.selectedRow.alertId,
                alertType: ((): AlertType => {
                  const t = (modalState.selectedRow.type ?? '').toUpperCase();
                  if (t.includes('FRAUD') && t.includes('AML'))
                    {return 'FRAUD_AND_AML';}
                  if (t.includes('AML')) return 'AML';
                  return 'FRAUD';
                })(),
                priority:
                  (modalState.selectedRow.priority?.toUpperCase() as Priority) ??
                  'NEW',
                priorityScore: 0.33,
              }
            : undefined
        }
      />

      <Suspense fallback={<div>Loading modal...</div>}>
        {selectedAlert && (
          <ManualTriageModal
            isOpen={modalState.isUpdateAlertOpen}
            alert={convertToTriageAlert(selectedAlert)}
            onClose={() => {
              modalActions.setIsUpdateAlertOpen(false);
              setSelectedAlert(null);
            }}
            onSubmit={async (triageData: ManualTriageDto) => {
              await handleManualTriage(selectedAlert, triageData);
            }}
          />
        )}
      </Suspense>

      <ViewCaseModal
        open={modalState.isViewOpen}
        onClose={closeViewCaseModal}
        row={modalState.selectedRow}
        onRefreshCases={onRefreshCases}
        onAfterTaskReassign={closeViewCaseModal}
        canManageSupervisorActions={permissions.canManageSupervisorActions}
        setSubCasesDetails={setSubCasesDetails}
        onComplete={(row) => {
          modalActions.setSelectedRow(row);
          if (row.type === null) {
            modalActions.setIsUpdateAlertOpen(true);
            openTriageModal();
            modalActions.setIsViewOpen(false);
          } else {
            modalActions.setIsCreateOpen(true);
            modalActions.setCreateModalMode('edit');
            modalActions.setEditingCaseId(row.id);
            modalActions.setIsViewOpen(false);
          }
        }}
        onCloseCase={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsCloseCaseOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onReopenCase={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsReopenOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onAbandonCase={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsAbandonOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onSuspendCase={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsSuspendOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onResumeCase={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsResumeOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onApproveCase={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsCaseClosureDecisionOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onApproveCaseReopen={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsApproveReopenOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onRejectCaseReopen={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsRejectReopenOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onApproveCaseCreation={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsApproveCreationOpen(true);
          modalActions.setIsViewOpen(false);
        }}
        onRejectCaseCreation={(row) => {
          modalActions.setSelectedRow(row);
          modalActions.setIsRejectCreationOpen(true);
          modalActions.setIsViewOpen(false);
        }}
      />

      <Suspense fallback={<div>Loading modal...</div>}>
        <CloseCaseModal
          open={modalState.isCloseCaseOpen}
          onClose={() => {
            modalActions.setIsCloseCaseOpen(false);
          }}
          caseId={
            modalState.selectedRow?.id == null
              ? ''
              : modalState.selectedRow.id.toString()
          }
          caseName={
            modalState.selectedRow ? `${modalState.selectedRow.type} Case` : ''
          }
          onSubmit={handleCloseCaseSubmit}
          caseData={modalState.selectedRow}
          subCasesDetails={
            modalState.selectedRow?.type === 'FRAUD_AND_AML'
              ? subCasesDetails
              : undefined
          }
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ReopenCaseModal
          open={modalState.isReopenOpen}
          onClose={() => {
            modalActions.setIsReopenOpen(false);
          }}
          onReopen={handleReopenSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <AbandonCaseModal
          open={modalState.isAbandonOpen}
          onClose={() => {
            modalActions.setIsAbandonOpen(false);
          }}
          onAbandon={handleAbandonSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <SuspendCaseModal
          open={modalState.isSuspendOpen}
          onClose={() => {
            modalActions.setIsSuspendOpen(false);
          }}
          onSuspend={handleSuspendSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ResumeCaseModal
          open={modalState.isResumeOpen}
          onClose={() => {
            modalActions.setIsResumeOpen(false);
          }}
          onResume={handleResumeSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <CaseClosureDecisionModal
          open={modalState.isCaseClosureDecisionOpen}
          onClose={() => {
            modalActions.setIsCaseClosureDecisionOpen(false);
          }}
          caseId={
            modalState.selectedRow?.id ?? null
          }
          caseName={
            modalState.selectedRow ? `${modalState.selectedRow.type} Case` : ''
          }
          //recommendedOutcome={modalState.selectedRow?.status || ''} //Commented to fix dropdown issue (PENDING APPROVAL)
          recommendedOutcome={'STATUS_83_CLOSED_INCONCLUSIVE'}
          taskList={modalState.selectedRow?.tasks ?? []}
          onApprove={handleApproveSubmit}
          onReject={handleRejectSubmit}
          caseData={modalState.selectedRow}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ApproveCaseCreationModal
          open={modalState.isApproveCreationOpen}
          onClose={() => {
            modalActions.setIsApproveCreationOpen(false);
          }}
          caseData={modalState.selectedRow}
          onSubmit={async (caseId) => {
            await handleApproveCreationSubmit(caseId);
          }}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <RejectCaseCreationModal
          open={modalState.isRejectCreationOpen}
          onClose={() => {
            modalActions.setIsRejectCreationOpen(false);
          }}
          caseData={modalState.selectedRow}
          onSubmit={async (caseId, data) => {
            await handleRejectCreationSubmit(caseId, data);
          }}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ApproveCaseReopenModal
          open={modalState.isApproveReopenOpen}
          onClose={() => {
            modalActions.setIsApproveReopenOpen(false);
          }}
          caseId={
            modalState.selectedRow?.id ?? null
          }
          requesterRole={undefined}
          onApprove={handleApproveReopenSubmit}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <RejectCaseReopenModal
          open={modalState.isRejectReopenOpen}
          onClose={() => {
            modalActions.setIsRejectReopenOpen(false);
          }}
          caseId={
            modalState.selectedRow?.id ?? null
          }
          onReject={handleRejectReopenSubmit}
        />
      </Suspense>
    </>
  );
};

export default CaseModalsManager;
