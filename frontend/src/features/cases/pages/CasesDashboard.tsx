import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import { CasesTable, CreateCaseModal, ViewCaseModal } from '..';
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
  type AbandonCaseDto,
  type RejectCaseDto,
  type ReopenCaseDto,
  type SuspendCaseDto,
  type ApproveCaseClosureDto,
  type ReturnCaseForReviewDto,
  type RejectCaseCreationDto} from '../services/caseService';
import type { CaseRow } from '../components/CasesTable';
import { transformBackendCaseToUI } from '../components/CasesTable';
import type { Priority, AlertType } from '../components/CreateCaseModal';
import { useAuth } from '../../auth/components/AuthContext';
import { useToast } from '../../../shared/providers/ToastProvider';

const CasesDashboard: React.FC = () => {
  const { user } = useAuth();
  const { success, error, warning, info } = useToast();
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

  useEffect(() => {
    const fetchAllCases = async () => {
      setLoading(true);
      setErrorState(null);
      
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
        setErrorState('Failed to load cases. Please try again.');
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
      success('Case Created', `Case ${newCase.case_id} created successfully with status: ${newCase.status}${alertInfo}`);
      
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
    } catch (err) {
      console.error('Error creating case:', err);
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

      console.log('Updating case with data:', updateCaseData);
      
      const updatedCase = await caseService.updateCase(caseId, updateCaseData);
      console.log('Case updated successfully:', updatedCase);
      
      // Replace alert with toast notification
      success('Draft Case Completed', `Case ${updatedCase.case_id} completed successfully with status: ${updatedCase.status}\nPriority: ${payload.priority}\nType: ${payload.alertType}`);
      
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
    } catch (err) {
      console.error('Error updating case:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update case';
      setCreateCaseError(errorMessage);
      // Show error toast
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
      
      // Replace alert with toast notification
      success('Case Investigation Complete', `Case ${selectedRow.id} has been submitted for supervisor approval.

Status Updates:
• Case Status: ${response.closed_case.status}
• Approval Task: ${response.approval_task.name}
• Assigned to: ${response.approval_task.assigned_to}
• Recommended Outcome: ${data.recommendedOutcome.replace('STATUS_', '').replace('_', ' - ')}

Supervisor has been notified of the new approval task.`);
      
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
      
    } catch (err) {
      console.error('Failed to close case:', err);
      
      let errorMessage = 'Failed to close case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';
      
      if (errorString.includes('not in a closeable state')) {
        errorMessage = `Case cannot be closed.

This case may not meet the closure requirements:
• Case must be "IN PROGRESS" status
• Must have an active "Investigate case" task
• Task must be assigned to you
• All other tasks must be complete

Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.

You don't have permission to close this case.
Please ensure you are the assigned investigator.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      }
      
      // Show error toast
      error('Close Case Failed', errorMessage);
    }
  };

  const handleReopenCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsReopenOpen(true);
  };

  const handleApproveCaseReopen = (row: CaseRow) => {
    setSelectedRow(row);
    setIsApproveReopenOpen(true);
  };

  const handleRejectCaseReopen = (row: CaseRow) => {
    setSelectedRow(row);
    setIsRejectReopenOpen(true);
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
    // TODO: Reopen functionality is not implemented in backend
    // This is a placeholder implementation
    console.log('Reopening case:', caseId, 'Reason:', reason);
    
    // Show a toast notification that this feature is not implemented
    error('Reopen Case', 'The reopen case functionality is not yet implemented in the system.');
    
    setIsReopenOpen(false);
    setSelectedRow(null);
    
    // Commenting out the actual implementation since there's no backend endpoint
    /*
    try {
      const reopenCaseData: ReopenCaseDto = {
        reason: reason.trim()
      };

      console.log('Reopening case:', caseId, 'Reason:', reason);
      
      const reopenedCase = await caseService.reopenCase(caseId, reopenCaseData);
      console.log('Case reopened successfully:', reopenedCase);
      
      success('Case Reopened', `Case ${caseId} has been successfully reopened.`);
      
      setIsReopenOpen(false);
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
      console.error('Error reopening case:', error);
      
      let errorMessage = 'Failed to request case reopening. Please try again.';
      const errorString = error instanceof Error ? error.message : '';
      
      if (errorString.includes('not in a reopenable state')) {
        errorMessage = `Case cannot be reopened.

This case may not meet the reopening requirements:
• Case must be in "CLOSED" status
• Case must not be already reopened

Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.

You don't have permission to reopen this case.
Please ensure you have the appropriate role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      }
      
      error('Reopen Case Failed', errorMessage);
    }
    */
  };

  const handleAbandonSubmit = async (caseId: string, reason: string) => {
    try {
      const abandonCaseData: AbandonCaseDto = {
        reason: reason.trim()
      };

      console.log('Abandoning case:', caseId, 'Reason:', reason);
      
      const abandonedCase = await caseService.abandonCase(caseId, abandonCaseData);
      console.log('Case abandoned successfully:', abandonedCase);
      
      // Replace alert with toast notification
      success('Case Abandoned', `Case ${caseId} has been successfully abandoned.\nReason: ${reason}\nStatus: ${abandonedCase.status}`);
      
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
    } catch (err) {
      console.error('Error abandoning case:', err);
      
      let errorMessage = 'Failed to abandon case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';
      
      if (errorString.includes('Cannot abandon case other than draft status')) {
        errorMessage = `Case cannot be abandoned.\n\n` +
                      `This case may not meet the abandonment requirements:\n` +
                      `• Case must be in "DRAFT" status\n` +
                      `• Case must have a "Complete New Case" task\n\n` +
                      `Please check the case status and try again.`;
      } else if (errorString.includes('No complete new Case Task exists')) {
        errorMessage = `Case cannot be abandoned.\n\n` +
                      `This case may not meet the abandonment requirements:\n` +
                      `• Case must be in "DRAFT" status\n` +
                      `• Case must have a "Complete New Case" task\n\n` +
                      `Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.\n\n` +
                      `You don't have permission to abandon this case.\n` +
                      `Please ensure you have the appropriate role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.\n\n` +
                      `The case may have been deleted or moved.`;
      }
      
      // Show error toast
      error('Abandon Case Failed', errorMessage);
    }
  };

  const handleSuspendSubmit = async (caseId: string, reason: string) => {
    try {
      const suspendCaseData: SuspendCaseDto = {
        reason: reason.trim()
      };

      console.log('Suspending case:', caseId, 'Reason:', reason);
      
      const suspendedCase = await caseService.suspendCase(caseId, suspendCaseData);
      console.log('Case suspended successfully:', suspendedCase);
      
      // Replace alert with toast notification
      success('Case Suspended', `Case ${caseId} has been successfully suspended.
Reason: ${reason}
Status: ${suspendedCase.status}

The case has been suspended and all associated tasks have been blocked. Supervisor has been notified of the suspension.`);
      
      setIsSuspendOpen(false);
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
    } catch (err) {
      console.error('Error suspending case:', err);
      
      let errorMessage = 'Failed to suspend case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';
      // Normalize backend message casing for UI consistency
      const normalizedErrorString = (errorString || '')
        .replace(/"Investigate case"/g, '"Investigate Case"')
        .replace(/\bcase\b/g, 'Case');
      
      if (errorString.includes('not in a suspendable state')) {
        errorMessage = `Case cannot be suspended.\n\n` +
                      `This case may not meet the suspension requirements:\n` +
                      `• Case must be in "IN PROGRESS" status\n` +
                      `• Case must not be already suspended or closed\n\n` +
                      `Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.\n\n` +
                      `You don't have permission to suspend this case.\n` +
                      `Please ensure you have the appropriate role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      } else if (normalizedErrorString) {
        // Fall back to normalized backend error if provided
        errorMessage = normalizedErrorString;
      }
      
      // Show error toast
      error('Suspend Case Failed', errorMessage);
    }
  };

  const handleResumeCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsResumeOpen(true);
  };

  const handleResumeSubmit = async (caseId: string, reason: string) => {
    try {
      const resumeCaseData = {
        reason: reason.trim()
      };

      console.log('Resuming case:', caseId, 'Reason:', reason);
      
      const resumedCase = await caseService.resumeCase(caseId, resumeCaseData);
      console.log('Case resumed successfully:', resumedCase);
      
      
      success('Case Resumed', `Case ${caseId} has been successfully resumed.
Reason: ${reason}
Status: ${resumedCase.status}

The case has been moved back to "In Progress" status. All associated tasks have been unblocked.`);
      
      setIsResumeOpen(false);
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
    } catch (err) {
      console.error('Error resuming case:', err);
      
      let errorMessage = 'Failed to resume case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';
      
      if (errorString.includes('not in a resumable state')) {
        errorMessage = `Case cannot be resumed.

` +
                      `This case may not meet the resumption requirements:
` +
                      `• Case must be in "SUSPENDED" status
` +
                      `• Case must not be already closed or completed

` +
                      `Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.

` +
                      `You don't have permission to resume this case.
` +
                      `Please ensure you have the appropriate role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

` +
                      `The case may have been deleted or moved.`;
      }
      
      // Show error toast
      error('Resume Case Failed', errorMessage);
    }
  };

  const handleRejectCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsRejectOpen(true);
  };

  const handleRejectSubmit = async (rejectionReason: string) => {
    if (!selectedRow) return;
    
    try {
      const rejectCaseData: RejectCaseDto = {
        rejectionReason: rejectionReason.trim()
      };

      console.log('Rejecting case:', selectedRow.id, 'Reason:', rejectionReason);
      
      const rejectedCase = await caseService.rejectCase(selectedRow.id, rejectCaseData);
      console.log('Case rejected successfully:', rejectedCase);
      
      // Replace alert with toast notification
      success('Case Closure Rejected', `Case ${selectedRow.id} closure has been successfully rejected.
Reason: ${rejectionReason}
Status: ${rejectedCase.status}

The case has been returned to the investigator for additional work.`);
      
      setIsRejectOpen(false);
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
    } catch (err) {
      console.error('Error rejecting case:', err);
      
      let errorMessage = 'Failed to reject case closure. Please try again.';
      const errorString = err instanceof Error ? err.message : '';
      
      if (errorString.includes('not in a rejectable state')) {
        errorMessage = `Case cannot be rejected.

` +
                      `This case may not meet the rejection requirements:
` +
                      `• Case must be pending final approval

` +
                      `Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.

` +
                      `You don't have permission to reject this case.
` +
                      `Please ensure you have the appropriate role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

` +
                      `The case may have been deleted or moved.`;
      } else if (errorString.includes('Approval task validation failed')) {
        // Show backend message as-is to "follow the backend"
        errorMessage = errorString;
      }
      
      // Show error toast
      error('Reject Case Failed', errorMessage);
    }
  };

  const handleApproveCase = (row: CaseRow) => {
    setSelectedRow(row);
    setIsApproveOpen(true);
  };

  const handleApproveSubmit = async (data: ApproveCaseClosureDto) => {
    if (!selectedRow) return;
    
    try {
      const approvedCase = await caseService.approveCaseClosure(selectedRow.id, data);
      console.log('Case approved successfully:', approvedCase);
      
      // Replace alert with toast notification
      success('Case Closure Approved', `Case ${selectedRow.id} closure has been successfully approved.

Final Outcome: ${data.finalOutcome.replace('STATUS_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
Status: ${approvedCase.status}

The case has been finalized with the selected outcome.`);
      
      setIsApproveOpen(false);
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
    } catch (err) {
      console.error('Error approving case:', err);
      
      let errorMessage = 'Failed to approve case closure. Please try again.';
      const errorString = err instanceof Error ? err.message : '';
      
      if (errorString.includes('not in pending approval status')) {
        errorMessage = `Case cannot be approved.

This case may not meet the approval requirements:
• Case must be in "PENDING FINAL APPROVAL" status
• Case must have an "Approve case closure" task
• Task must be assigned to supervisor

Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.

You don't have permission to approve this case closure.
Please ensure you have supervisor role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      } else if (errorString.includes('Approval task validation failed')) {
        errorMessage = `Approval Task Validation Failed.

` +
                      `The case may not have the required "Approve case closure" task, 
` +
                      `or the task may not be in the correct state.

` +
                      `Please verify that:
` +
                      `• The case is in "PENDING FINAL APPROVAL" status
` +
                      `• An "Approve case closure" task exists for this case
` +
                      `• The task is in "UNASSIGNED" state and assigned to you`;
      }
      
      // Show error toast
      error('Approve Case Failed', errorMessage);
    }
  };

  const handleApproveCaseCreation = (row: CaseRow) => {
    setSelectedRow(row);
    setIsApproveCreationOpen(true);
  };

  const handleApproveCreationSubmit = async (caseId: string) => {
    try {
      const approvedCase = await caseService.approveCaseCreation(caseId);
      console.log('Case creation approved successfully:', approvedCase);
      
      // Replace alert with toast notification
      success('Case Creation Approved', `Case ${caseId} creation has been successfully approved.

Status: ${approvedCase.status}

The case has been moved to "READY FOR ASSIGNMENT" status. An "Investigate Case" task has been created in the Flowable investigations queue.`);
      
      setIsApproveCreationOpen(false);
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
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.

You don't have permission to approve this case creation.
Please ensure you have supervisor role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      }
      
      // Show error toast
      error('Approve Case Creation Failed', errorMessage);
    }
  };

  const handleRejectCaseCreation = (row: CaseRow) => {
    setSelectedRow(row);
    setIsRejectCreationOpen(true);
  };

  const handleRejectCreationSubmit = async (caseId: string, data: RejectCaseCreationDto) => {
    try {
      const rejectedCase = await caseService.rejectCaseCreation(caseId, data);
      console.log('Case creation rejected successfully:', rejectedCase);
      
      // Replace alert with toast notification
      success('Case Creation Rejected', `Case ${caseId} creation has been successfully rejected.

Reason: ${data.reason}
Status: ${rejectedCase.status}

The case has been returned to "DRAFT" status. A "Complete New Case" task has been assigned to the original creator.`);
      
      setIsRejectCreationOpen(false);
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
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.

You don't have permission to reject this case creation.
Please ensure you have supervisor role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      }
      
      // Show error toast
      error('Reject Case Creation Failed', errorMessage);
    }
  };

  const handleReturnForReview = (row: CaseRow) => {
    setSelectedRow(row);
    setIsReturnForReviewOpen(true);
  };

  const handleReturnForReviewSubmit = async (caseId: string, data: ReturnCaseForReviewDto) => {
    if (!selectedRow) return;
    
    try {
      const returnedCase = await caseService.returnCaseForReview(caseId, data);
      console.log('Case returned for review successfully:', returnedCase);
      
      // Replace alert with toast notification
      success('Case Returned for Review', `Case ${caseId} has been successfully returned for additional review.

Review Comments: ${data.reviewComments}
Status: ${returnedCase.status}

The case has been returned to the investigator for additional work.`);
      
      setIsReturnForReviewOpen(false);
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
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Access Denied.

You don't have permission to return this case for review.
Please ensure you have supervisor role.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Case Not Found.

The case may have been deleted or moved.`;
      } else if (errorString.includes('Approval task validation failed')) {
        errorMessage = `Approval Task Validation Failed.

` +
                      `The case may not have the required "Approve case closure" task, 
` +
                      `or the task may not be in the correct state.

` +
                      `Please verify that:
` +
                      `• The case is in "PENDING FINAL APPROVAL" status
` +
                      `• An "Approve case closure" task exists for this case
` +
                      `• The task is in "UNASSIGNED" state and assigned to you`;
      }
      
      // Show error toast
      error('Return Case for Review Failed', errorMessage);
    }
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
            onApproveCaseReopen={handleApproveCaseReopen}
            onRejectCaseReopen={handleRejectCaseReopen}
            onApproveCaseCreation={handleApproveCaseCreation}
            onRejectCaseCreation={handleRejectCaseCreation}
            onReturnForReview={handleReturnForReview}
            
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
            console.error('Error approving case reopening:', err);
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
            console.error('Error rejecting case reopening:', err);
            const message = err instanceof Error ? err.message : 'Failed to reject case reopening';
            error('Reject Case Reopening Failed', message);
          }
        }}
      />
    </PageContainer>
  );
};

export default CasesDashboard;
