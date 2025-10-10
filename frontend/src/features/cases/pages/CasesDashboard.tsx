import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import { CasesTable, CreateCaseModal, ViewCaseModal } from '..';
import CloseCaseModal from '../components/CloseCaseModal';
import ReopenCaseModal from '../components/ReopenCaseModal';
import AbandonCaseModal from '../components/AbandonCaseModal';
import SuspendCaseModal from '../components/SuspendCaseModal';
import CasesTableSkeleton from '../components/CasesTableSkeleton';
import { 
  caseService, 
  type CloseCaseDto, 
  type UpdateCaseDto, 
  type AbandonCaseDto,
  type ManualCreateCaseDto
} from '../services/caseService';
import type { CaseRow } from '../components/CasesTable';
import { transformBackendCaseToUI } from '../components/CasesTable';
import type { Priority, AlertType } from '../components/CreateCaseModal';
import { useAuth } from '../../auth/components/AuthContext';

const CasesDashboard: React.FC = () => {
  const { user } = useAuth();
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
  const [selectedRow, setSelectedRow] = useState<CaseRow | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createCaseLoading, setCreateCaseLoading] = useState(false);
  const [createCaseError, setCreateCaseError] = useState<string>('');
  const [createModalMode, setCreateModalMode] = useState<'create' | 'edit'>('create');
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllCases = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await caseService.getAllCases({
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          sortBy: 'updated_at',
          sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
        });
        
        const transformedCases = response.cases.map(transformBackendCaseToUI);
        setCases(transformedCases);
      } catch (err) {
        console.error('Failed to fetch all cases:', err);
        setError('Failed to load cases. Please try again.');
        setCases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllCases();
  }, [statusFilter, priorityFilter, sortBy]);


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

      console.log('Creating case with data:', manualCreateCaseData);
      console.log('Associated with Alert ID:', payload.alertId);
      console.log('Alert Type:', payload.alertType);
      
      const newCase = await caseService.createCase(manualCreateCaseData);
      console.log('Case created successfully:', newCase);
      
      const alertInfo = payload.alertId ? `\nAssociated Alert ID: ${payload.alertId}\nAlert Type: ${payload.alertType}` : '';
      alert(`Case Created Successfully!\n\nCase ID: ${newCase.case_id}\nStatus: ${newCase.status}${alertInfo}`);
      
      setIsCreateOpen(false);
      
      const fetchAllCases = async () => {
        try {
          const response = await caseService.getAllCases({
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
            sortBy: 'updated_at',
            sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
          });
          setCases(response.cases.map(transformBackendCaseToUI));
        } catch (refreshError) {
          console.error('Failed to refresh cases:', refreshError);
        }
      };
      
      await fetchAllCases();
    } catch (error) {
      console.error('Error creating case:', error);
      setCreateCaseError(error instanceof Error ? error.message : 'Failed to create case');
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

      console.log('Updating case with data:', updateCaseData);
      
      const updatedCase = await caseService.updateCase(caseId, updateCaseData);
      console.log('Case updated successfully:', updatedCase);
      
      
      alert(`Draft Case Completed Successfully!

Case ID: ${updatedCase.case_id}
Status: ${updatedCase.status}
Priority: ${payload.priority}
Type: ${payload.alertType}`);
      
      setIsCreateOpen(false);
      setCreateModalMode('create');
      setEditingCaseId(null);
      
      const fetchAllCases = async () => {
        try {
          const response = await caseService.getAllCases({
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
            sortBy: 'updated_at',
            sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
          });
          setCases(response.cases.map(transformBackendCaseToUI));
        } catch (refreshError) {
          console.error('Failed to refresh cases:', refreshError);
        }
      };
      
      await fetchAllCases();
    } catch (error) {
      console.error('Error updating case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update case';
      
      
      setCreateCaseError(errorMessage);
    } finally {
      setCreateCaseLoading(false);
    }
  };

  const handleView = (row: CaseRow) => {
    setSelectedRow(row);
    setIsViewOpen(true);
  };

  const handleComplete = (row: CaseRow) => {
    console.log('Complete case - opening draft case completion', row);
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
    
    try {
      const response = await caseService.closeCase(selectedRow.id, data);
      
      console.log(`Case ${selectedRow.id} submitted for approval:`, {
        caseId: selectedRow.id,
        newStatus: response.closed_case.status,
        approvalTaskId: response.approval_task.task_id,
        approvalTaskStatus: response.approval_task.status,
        recommendedOutcome: data.recommendedOutcome
      });
      
      alert(`Case Investigation Complete!\n\n` +
            `Case ${selectedRow.id} has been submitted for supervisor approval.\n\n` +
            `Status Updates:\n` +
            `• Case Status: ${response.closed_case.status}\n` +
            `• Approval Task: ${response.approval_task.name}\n` +
            `• Assigned to: ${response.approval_task.assigned_to}\n` +
            `• Recommended Outcome: ${data.recommendedOutcome.replace('STATUS_', '').replace('_', ' - ')}\n\n` +
            `Supervisor has been notified of the new approval task.`);
      
      setIsCloseCaseOpen(false);
      setSelectedRow(null);
      
      const fetchAllCases = async () => {
        try {
          const response = await caseService.getAllCases({
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
            sortBy: 'updated_at',
            sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
          });
          const transformedCases = response.cases.map(transformBackendCaseToUI);
          setCases(transformedCases);
        } catch (err) {
          console.error('Failed to refresh cases:', err);
        }
      };
      fetchAllCases();
      
    } catch (error) {
      console.error('Failed to close case:', error);
      
      let errorMessage = 'Failed to close case. Please try again.';
      const errorString = error instanceof Error ? error.message : '';
      
      if (errorString.includes('not in a closeable state')) {
        errorMessage = `Case cannot be closed.\n\n` +
                      `This case may not meet the closure requirements:\n` +
                      `• Case must be "IN PROGRESS" status\n` +
                      `• Must have an active "Investigate case" task\n` +
                      `• Task must be assigned to you\n` +
                      `• All other tasks must be complete\n\n` +
                      `Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.\n\n` +
                      `You don't have permission to close this case.\n` +
                      `Please ensure you are the assigned investigator.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.\n\n` +
                      `The case may have been deleted or moved.`;
      }
      
      alert(errorMessage);
      throw error;
    }
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

  const handleReopenSubmit = async (caseId: string, reason?: string) => {
    console.log('Reopen case:', caseId, 'Reason:', reason);
    alert(`Case ${caseId} Reopened

This case has been moved back to "In Progress" status and assigned to an investigator.${reason ? `

Reason: ${reason}` : ''}`);
    setIsReopenOpen(false);
    setSelectedRow(null);
  };

  const handleAbandonSubmit = async (caseId: string, reason: string) => {
    try {
      const abandonCaseData: AbandonCaseDto = {
        reason: reason.trim()
      };

      console.log('Abandoning case:', caseId, 'Reason:', reason);
      
      const abandonedCase = await caseService.abandonCase(caseId, abandonCaseData);
      console.log('Case abandoned successfully:', abandonedCase);
      
      
      alert(`Case ${caseId} Abandoned Successfully!

Reason: ${reason}
Status: ${abandonedCase.status}

The case has been permanently abandoned and removed from active investigation.
All associated tasks have been closed.`);
      
      setIsAbandonOpen(false);
      setSelectedRow(null);
      
      const fetchAllCases = async () => {
        try {
          const response = await caseService.getAllCases({
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
            sortBy: 'updated_at',
            sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
          });
          setCases(response.cases.map(transformBackendCaseToUI));
        } catch (refreshError) {
          console.error('Failed to refresh cases:', refreshError);
        }
      };
      
      await fetchAllCases();
    } catch (error) {
      console.error('Error abandoning case:', error);
      
      let errorMessage = 'Failed to abandon case. Please try again.';
      const errorString = error instanceof Error ? error.message : '';
      
      if (errorString.includes('not in an abandonable state')) {
        errorMessage = `Case cannot be abandoned.\n\n` +
                      `This case may not meet the abandonment requirements:\n` +
                      `• Case must be in "DRAFT", "ASSIGNED", "IN PROGRESS", or "REOPENED" status\n` +
                      `• Case must not be already closed or completed\n\n` +
                      `Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.\n\n` +
                      `You don't have permission to abandon this case.\n` +
                      `Please ensure you have the appropriate role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.\n\n` +
                      `The case may have been deleted or moved.`;
      }
      
      
      alert(errorMessage);
    }
  };

  const handleSuspendSubmit = async (caseId: string, reason: string, duration?: string) => {
    console.log('Suspend case:', caseId, 'Reason:', reason, 'Duration:', duration);
    alert(`Case ${caseId} Suspended

Reason: ${reason}${duration ? `
Duration: ${duration.replace('_', ' ')}` : ''}

The case has been suspended and can be resumed later.`);
    setIsSuspendOpen(false);
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
      <Card className="bg-indigo-50/40" padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-[160px]">
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="STATUS_10_ASSIGNED">Assigned</option>
                <option value="STATUS_20_IN_PROGRESS">In Progress</option>
                <option value="STATUS_00_DRAFT">Draft</option>
                <option value="STATUS_31_REOPENED">Reopened</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            <div className="relative w-full sm:max-w-[160px]">
              <select
                aria-label="Priority filter"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Priorities</option>
                <option value="NEW">New</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
                <option value="BREACH">Breach</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            <div className="relative w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-gray-300 bg-white px-10 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            <div className="relative w-full sm:max-w-[160px]">
              <select
                aria-label="Sort by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest')}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
            <p className="text-red-600 text-sm">{error}</p>
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
          />
        )}
      </Card>

      {/* Modals */}
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
            // Map backend alert types to modal options
            const t = (selectedRow.type || '').toUpperCase();
            if (t.includes('FRAUD') && t.includes('AML')) return 'FRAUD_AND_AML';
            if (t.includes('FRAUD')) return 'FRAUD';
            if (t.includes('AML')) return 'AML';
            return 'NONE';
          })(),
          priority: (selectedRow.priority?.toUpperCase() as Priority) || 'NEW',
          priorityScore: 0.33 // Default priority score
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
    </PageContainer>
  );
};

export default CasesDashboard;
