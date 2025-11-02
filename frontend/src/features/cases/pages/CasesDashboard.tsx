import React, { useState, useEffect } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import { CasesTable, CreateCaseModal, ViewCaseModal } from '..';
import CaseFilters from '../components/CaseFilters';
import CloseCaseModal from '../components/CloseCaseModal';
import ApproveCaseReopenModal from '../components/ApproveCaseReopenModal';
import RejectCaseReopenModal from '../components/RejectCaseReopenModal';
import ReopenCaseModal from '../components/ReopenCaseModal';
import AbandonCaseModal from '../components/AbandonCaseModal';
import SuspendCaseModal from '../components/SuspendCaseModal';
import ResumeCaseModal from '../components/ResumeCaseModal';
import RejectCaseModal from '../components/RejectCaseModal';
import ApproveCaseModal from '../components/ApproveCaseModal';
import ApproveCaseCreationModal from '../components/ApproveCaseCreationModal';
import RejectCaseCreationModal from '../components/RejectCaseCreationModal';
import ReturnCaseForReviewModal from '../components/ReturnCaseForReviewModal';
import CasesTableSkeleton from '../components/CasesTableSkeleton';
import {
  caseService,
  type CloseCaseDto,
  type UpdateCaseDto,
  type ApproveCaseClosureDto,
  type ReturnCaseForReviewDto,
  type RejectCaseCreationDto} from '../services/caseService';
import type { CaseRow } from '../components/CasesTable';
import { transformBackendCaseToUI } from '../components/CasesTable';
import type { Priority, AlertType } from '../components/CreateCaseModal';
import { useAuth } from '../../auth/components/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';
import { useCaseActions } from '../hooks';

const CasesDashboard: React.FC = () => {
  const { user, hasInvestigatorRole, hasSupervisorRole, hasAdminRole } = useAuth();
  const { success, error, } = useToast();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isCloseCaseOpen, setIsCloseCaseOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [isAbandonOpen, setIsAbandonOpen] = useState(false);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproveCreationOpen, setIsApproveCreationOpen] = useState(false);
  const [isRejectCreationOpen, setIsRejectCreationOpen] = useState(false);
  const [isReturnForReviewOpen, setIsReturnForReviewOpen] = useState(false);
  const [isApproveReopenOpen, setIsApproveReopenOpen] = useState(false);
  const [isRejectReopenOpen, setIsRejectReopenOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CaseRow | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [createCaseLoading, setCreateCaseLoading] = useState(false);
  const [createCaseError, setCreateCaseError] = useState<string>('');
  const [createModalMode, setCreateModalMode] = useState<'create' | 'edit'>('create');
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

 
 
  const {
    handleCloseCaseSubmit: hookHandleCloseSubmit,
    handleAbandonSubmit: hookHandleAbandonSubmit,
    handleSuspendSubmit: hookHandleSuspendSubmit,
    handleResumeSubmit: hookHandleResumeSubmit,
    handleApproveClosureSubmit: hookHandleApproveClosureSubmit,
    handleApproveCreation: hookHandleApproveCreation,
    handleRejectCaseCreation: hookHandleRejectCaseCreation,
    handleRejectCase: hookHandleRejectCase,
    handleReturnForReview: hookHandleReturnForReview,
    handleReopenSubmit: hookHandleReopenSubmit,
  } = useCaseActions(() => fetchCases());

 
  const fetchCases = async () => {
    setLoading(true);
    setErrorState(null);

    try {
      let response;
      
     
      const isInvestigatorOnly = hasInvestigatorRole() && !hasSupervisorRole() && !hasAdminRole();
      
      if (isInvestigatorOnly) {
       
        response = await caseService.getUserAssignedCases({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          includeTaskAssignments: true,
          includeOwnedCases: true,
          sortBy: 'updated_at',
          sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
        });
      } else {
     
        response = await caseService.getAllCases({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          sortBy: 'updated_at',
          sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
        });
      }

      const transformedCases = response.cases.map(transformBackendCaseToUI);
      setCases(transformedCases);
    } catch (err) {
      setErrorState('Failed to load cases. Please try again.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [statusFilter, priorityFilter, sortBy, hasInvestigatorRole, hasSupervisorRole, hasAdminRole]);


  const filtered = cases.filter((c) =>
    search === '' || [
      c.id,
      c.type,
      c.status,
      c.typologyId,
      String(c.score),
      c.createdOn,
      c.pickedOn,
      c.assignee || '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleCreate = async (payload: {
    alertId?: string;
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

      const alertInfo = payload.alertId ? `\nAssociated Alert ID: ${payload.alertId}\nAlert Type: ${payload.alertType}` : '';
      success('Case Created', `Case ${newCase.case_id} created successfully with status: ${newCase.status}${alertInfo}`);

      setIsCreateOpen(false);

      await fetchCases();
    } catch (err) {
      setCreateCaseError(err instanceof Error ? err.message : 'Failed to create case');
      error('Create Case Failed', err instanceof Error ? err.message : 'Failed to create case');
    } finally {
      setCreateCaseLoading(false);
    }
  };

  const handleUpdate = async (caseId: string, payload: {
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
  }) => {
    setCreateCaseLoading(true);
    setCreateCaseError('');

    try {
      const updateCaseData: UpdateCaseDto = {
        status: 'STATUS_02_READY_FOR_ASSIGNMENT',
        priority: payload.priority,
        caseType: payload.alertType,
        caseOwnerUserId: payload.assignee || user?.user_id || 'system-user-id',
      };


      const updatedCase = await caseService.updateCase(caseId, updateCaseData);

      success('Draft Case Completed', `Case ${updatedCase.case_id} completed successfully with status: ${updatedCase.status}\nPriority: ${payload.priority}\nType: ${payload.alertType}`);

      setIsCreateOpen(false);
      setCreateModalMode('create');
      setEditingCaseId(null);

      await fetchCases();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update case';
      setCreateCaseError(errorMessage);
      error('Update Case Failed', errorMessage);
    } finally {
      setCreateCaseLoading(false);
    }
  };

  const handleView = (row: CaseRow) => {
    setSelectedRow(row);
    setIsViewOpen(true);
  };

  const handleComplete = (row: CaseRow) => {
    setSelectedRow(row);
    setCreateModalMode('edit');
    setEditingCaseId(row.id);
    setIsCreateOpen(true);
  };

  const handleCloseCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsCloseCaseOpen(true);
  };

  const handleCloseCaseSubmit = async (data: CloseCaseDto) => {
    if (!selectedRow) return;
    await hookHandleCloseSubmit(selectedRow.id, data);
    setIsCloseCaseOpen(false);
    setSelectedRow(null);
  };

  const handleReopenCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsReopenOpen(true);
  };

  const handleAbandonCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsAbandonOpen(true);
  };

  const handleSuspendCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsSuspendOpen(true);
  };

  const handleReopenSubmit = async (caseId: string, reason: string) => {
    await hookHandleReopenSubmit(caseId, reason);
    setIsReopenOpen(false);
    setSelectedRow(null);
  };

  const handleAbandonSubmit = async (caseId: string, reason: string) => {
    await hookHandleAbandonSubmit(caseId, reason);
    setIsAbandonOpen(false);
    setSelectedRow(null);
  };

  const handleSuspendSubmit = async (caseId: string, reason: string) => {
    await hookHandleSuspendSubmit(caseId, reason);
    setIsSuspendOpen(false);
    setSelectedRow(null);
  };

  const handleResumeCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsResumeOpen(true);
  };

  const handleResumeSubmit = async (caseId: string, reason: string) => {
    await hookHandleResumeSubmit(caseId, reason);
    setIsResumeOpen(false);
    setSelectedRow(null);
  };

  const handleRejectCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsRejectOpen(true);
  };

  const handleRejectSubmit = async (rejectionReason: string) => {
    if (!selectedRow) return;
    await hookHandleRejectCase(selectedRow.id, rejectionReason);
    setIsRejectOpen(false);
    setSelectedRow(null);
  };

  const handleApproveCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsApproveOpen(true);
  };

  const handleApproveSubmit = async (data: ApproveCaseClosureDto) => {
    if (!selectedRow) return;
    await hookHandleApproveClosureSubmit(selectedRow.id, data.finalOutcome, data.supervisorComments);
    setIsApproveOpen(false);
    setSelectedRow(null);
  };

  const handleApproveCaseCreation = (row: CaseRow) => {
    setSelectedRow(row);
    setIsApproveCreationOpen(true);
  };

  const handleApproveCreationSubmit = async (caseId: string) => {
    await hookHandleApproveCreation(caseId);
    setIsApproveCreationOpen(false);
    setSelectedRow(null);
  };

  const handleRejectCaseCreation = (row: CaseRow) => {
    setSelectedRow(row);
    setIsRejectCreationOpen(true);
  };

  const handleRejectCreationSubmit = async (caseId: string, data: RejectCaseCreationDto) => {
    await hookHandleRejectCaseCreation(caseId, data.reason);
    setIsRejectCreationOpen(false);
    setSelectedRow(null);
  };

  const handleReturnForReview = (row: CaseRow) => {
    setSelectedRow(row);
    setIsReturnForReviewOpen(true);
  };

  const handleReturnForReviewSubmit = async (caseId: string, data: ReturnCaseForReviewDto) => {
    if (!selectedRow) return;
    await hookHandleReturnForReview(caseId, data.reviewComments);
    setIsReturnForReviewOpen(false);
    setSelectedRow(null);
  };

  return (
    <PageContainer
      title="Cases Dashboard"
      subtitle="Manage and track investigation cases"
      actions={
        <button onClick={() => {
          setCreateModalMode('create');
          setEditingCaseId(null);
          setSelectedRow(null);
          setIsCreateOpen(true);
        }} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <PlusIcon className="h-4 w-4" />
          Create Manually
        </button>
      }
    >
      <CaseFilters
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortChange={setSortBy}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
      />

      <Card className="mt-4">
        {errorState && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
            <p className="text-red-600 text-sm">{errorState}</p>
          </div>
        )}

        {loading ? (
          <CasesTableSkeleton rows={10} />
        ) : (
          <CasesTable
            rows={filtered}
            onView={handleView}
            onComplete={handleComplete}
            onCloseCase={handleCloseCase}
            onReopenCase={handleReopenCase}
            onAbandonCase={handleAbandonCase}
            onSuspendCase={handleSuspendCase}
            onResumeCase={handleResumeCase}
            onRejectCase={handleRejectCase}
            onApproveCase={handleApproveCase}
            onApproveCaseCreation={handleApproveCaseCreation}
            onRejectCaseCreation={handleRejectCaseCreation}
            onReturnForReview={handleReturnForReview}

          />
        )}
      </Card>

      {}
      <CreateCaseModal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateCaseError('');
          setCreateModalMode('create');
          setEditingCaseId(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        loading={createCaseLoading}
        error={createCaseError}
        mode={createModalMode}
        existingCaseId={editingCaseId || undefined}
        initial={selectedRow ? {
          alertId: selectedRow.alertId,
          alertType: ((): AlertType => {
            const t = (selectedRow.type || '').toUpperCase();
            if (t.includes('FRAUD') && t.includes('AML')) return 'FRAUD_AND_AML';
            if (t.includes('FRAUD')) return 'FRAUD';
            if (t.includes('AML')) return 'AML';
            return 'NONE';
          })(),
          priority: (selectedRow.priority?.toUpperCase() as Priority) || 'NEW',
          priorityScore: 0.33
        } : undefined}
      />
      <ViewCaseModal
        open={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        row={selectedRow}
      />
      <CloseCaseModal
        open={isCloseCaseOpen}
        onClose={() => setIsCloseCaseOpen(false)}
        caseId={selectedRow?.id || ''}
        caseName={selectedRow ? `${selectedRow.type} Case` : ''}
        onSubmit={handleCloseCaseSubmit}
      />
      <ReopenCaseModal
        open={isReopenOpen}
        onClose={() => setIsReopenOpen(false)}
        onReopen={handleReopenSubmit}
        caseData={selectedRow}
      />
      <AbandonCaseModal
        open={isAbandonOpen}
        onClose={() => setIsAbandonOpen(false)}
        onAbandon={handleAbandonSubmit}
        caseData={selectedRow}
      />
      <SuspendCaseModal
        open={isSuspendOpen}
        onClose={() => setIsSuspendOpen(false)}
        onSuspend={handleSuspendSubmit}
        caseData={selectedRow}
      />
      <ResumeCaseModal
        open={isResumeOpen}
        onClose={() => setIsResumeOpen(false)}
        onResume={handleResumeSubmit}
        caseData={selectedRow}
      />
      <RejectCaseModal
        open={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        caseId={selectedRow?.id || ''}
        caseName={selectedRow ? `${selectedRow.type} Case` : ''}
        onSubmit={handleRejectSubmit}
      />
      <ApproveCaseModal
        open={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        caseId={selectedRow?.id || ''}
        caseName={selectedRow ? `${selectedRow.type} Case` : ''}
        recommendedOutcome={selectedRow?.status || ''}
        onSubmit={handleApproveSubmit}
      />
      <ApproveCaseCreationModal
        open={isApproveCreationOpen}
        onClose={() => setIsApproveCreationOpen(false)}
        caseData={selectedRow}
        onSubmit={(caseId) => handleApproveCreationSubmit(caseId)}
      />
      <RejectCaseCreationModal
        open={isRejectCreationOpen}
        onClose={() => setIsRejectCreationOpen(false)}
        caseData={selectedRow}
        onSubmit={(caseId, data) => handleRejectCreationSubmit(caseId, data)}
      />
      <ReturnCaseForReviewModal
        open={isReturnForReviewOpen}
        onClose={() => setIsReturnForReviewOpen(false)}
        caseData={selectedRow}
        onSubmit={(caseId, data) => handleReturnForReviewSubmit(caseId, data)}
      />

      <ApproveCaseReopenModal
        open={isApproveReopenOpen}
        onClose={() => setIsApproveReopenOpen(false)}
        caseId={selectedRow?.id || ''}
        requesterRole={undefined}
        onApprove={async (caseId) => {
          try {
            const resp = await caseService.approveCaseReopening(caseId);

            const updatedStatus = resp.case?.status;
            let outcomeDetails = '';
            if (updatedStatus === 'STATUS_10_ASSIGNED') {
              const assignedTo = resp.investigation_task?.assigned_to ? ` and assigned to ${resp.investigation_task.assigned_to}` : '';
              outcomeDetails = `\n\nStatus: STATUS_10_ASSIGNED\nAn \"Investigate Case\" task (${resp.investigation_task?.task_id || 'N/A'}) has been created${assignedTo}.`;
            } else if (updatedStatus === 'STATUS_02_READY_FOR_ASSIGNMENT') {
              const candidateGroup = resp.investigation_task?.candidateGroup || 'Investigations';
              outcomeDetails = `\n\nStatus: STATUS_02_READY_FOR_ASSIGNMENT\nAn \"Investigate Case\" task (${resp.investigation_task?.task_id || 'N/A'}) has been created in the ${candidateGroup} queue.`;
            } else if (updatedStatus === 'STATUS_31_REOPENED') {
              outcomeDetails = `\n\nStatus: STATUS_31_REOPENED\nAn \"Investigate Case\" task has been created.`;
            }

            success('Case Reopening Approved', `Case ${caseId} reopening has been approved.${outcomeDetails}`);
            setIsApproveReopenOpen(false);
            setSelectedRow(null);

            const response = await caseService.getAllCases({
              status: statusFilter || undefined,
              priority: priorityFilter || undefined,
              sortBy: 'updated_at',
              sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
            });
            setCases(response.cases.map(transformBackendCaseToUI));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to approve case reopening';
            error('Approve Case Reopening Failed', message);
          }
        }}
      />

      <RejectCaseReopenModal
        open={isRejectReopenOpen}
        onClose={() => setIsRejectReopenOpen(false)}
        caseId={selectedRow?.id || ''}
        onReject={async (_caseId, _reason) => {
          try {
            const resp = await caseService.rejectCaseReopening(_caseId, _reason);

            let outcomeDetails = `\n\nReason: ${resp.rejection_reason || _reason}`;
            const status = resp.case?.status;
            if (status?.startsWith('STATUS_8') || status?.startsWith('STATUS_7')) {
              outcomeDetails += `\nStatus: ${status}\nThe case remains closed.`;
            }

            success('Case Reopening Rejected', `Case ${_caseId} reopening has been rejected.${outcomeDetails}`);
            setIsRejectReopenOpen(false);
            setSelectedRow(null);

            const response = await caseService.getAllCases({
              status: statusFilter || undefined,
              priority: priorityFilter || undefined,
              sortBy: 'updated_at',
              sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
            });
            setCases(response.cases.map(transformBackendCaseToUI));
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to reject case reopening';
            error('Reject Case Reopening Failed', message);
          }
        }}
      />
    </PageContainer>
  );
};

export default CasesDashboard;
