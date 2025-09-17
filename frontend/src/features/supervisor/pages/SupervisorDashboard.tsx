import React, { useState } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import SupervisorCasesTable from '../components/SupervisorCasesTable';
import SupervisorCasesTableSkeleton from '../components/SupervisorCasesTableSkeleton';
import CreateCaseModal from '../components/CreateCaseModal';
import ViewCaseModal from '../components/ViewCaseModal';
import AssignCaseModal from '../components/AssignCaseModal';
import ApproveCaseClosureModal from '../components/ApproveCaseClosureModal';
import { type CaseForSupervisor, type ApproveCaseClosureDto, supervisorService } from '../services/supervisorService';
import { caseService, type CloseCaseDto } from '../../cases/services/caseService';


const SupervisorDashboard: React.FC = () => {
  // State for filters and search
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  
  // Selected case data
  const [selectedCase, setSelectedCase] = useState<CaseForSupervisor | null>(null);
  const [allCases, setAllCases] = useState<CaseForSupervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load all cases from API
  React.useEffect(() => {
    const loadAllCases = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await caseService.getAllCases({
          priority: priorityFilter || undefined,
          status: statusFilter || undefined,
          sortBy: 'updated_at',
          sortOrder: sortBy === 'recent' ? 'desc' : 'asc'
        });
        
        // Transform CaseWithTasksDto[] to CaseForSupervisor[]
        const transformedCases: CaseForSupervisor[] = response.cases.map(caseData => ({
          case_id: caseData.case_id,
          status: caseData.status,
          priority: caseData.priority,
          case_type: caseData.case_type,
          created_at: caseData.created_at,
          updated_at: caseData.updated_at,
          investigator_id: undefined, // Not available in CaseWithTasksDto
          investigator_name: undefined, // Not available in CaseWithTasksDto
          owner_id: undefined, // Not available in CaseWithTasksDto
          owner_name: undefined, // Not available in CaseWithTasksDto
          alert: caseData.alert ? {
            alert_id: caseData.alert.alert_id,
            message: caseData.alert.message,
            confidence_per: caseData.alert.confidence_per
          } : undefined,
          recommended_outcome: undefined, // Not available in CaseWithTasksDto
          final_notes: undefined, // Not available in CaseWithTasksDto
          recommendations: undefined, // Not available in CaseWithTasksDto
          approval_task_id: undefined // Not available in CaseWithTasksDto
        }));
        
        setAllCases(transformedCases);
      } catch (err) {
        console.error('Failed to load all cases:', err);
        setError(err as Error);
        
        // Don't use mock data - let the error show so we can see what's happening
        setAllCases([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllCases();
  }, [priorityFilter, statusFilter, sortBy]);

  // Filter cases based on search
  const filteredCases = allCases.filter((c: CaseForSupervisor) =>
    search === '' || [
      c.case_id,
      c.case_type,
      c.investigator_name || '',
      c.owner_name || '',
      c.status,
      c.recommended_outcome || '',
      c.final_notes || '',
      c.recommendations || '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleCreateCase = () => {
    setShowCreateModal(true);
  };

  const handleReview = (caseData: CaseForSupervisor) => {
    setSelectedCase(caseData);
    setShowReviewModal(true);
  };

  const handleApprove = (caseData: CaseForSupervisor) => {
    setSelectedCase(caseData);
    setShowApprovalModal(true);
  };

  const handleAssign = (caseData: CaseForSupervisor) => {
    setSelectedCase(caseData);
    setShowAssignModal(true);
  };

  const handleCloseCase = (caseData: CaseForSupervisor) => {
    // Set the selected case and open the approval modal for case closure
    setSelectedCase({
      ...caseData,
      // Set default values for case closure
      recommended_outcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
      final_notes: 'Case closed by supervisor - pending final review',
      recommendations: 'Supervisor initiated case closure'
    });
    setShowApprovalModal(true);
  };

  const handleCreateCaseSubmit = (payload: any) => {
    console.log('Creating case:', payload);
    setShowCreateModal(false);
  };

  const handleApprovalSubmit = async (approvalData: ApproveCaseClosureDto) => {
    if (!selectedCase) return;
    
    try {
      // Check if this is a case closure (no approval_task_id) or an approval (has approval_task_id)
      if (selectedCase.approval_task_id) {
        // This is an existing case pending approval - use supervisor service
        await supervisorService.approveCaseClosure(selectedCase.approval_task_id, approvalData);
        
        console.log('Case approval processed successfully:', {
          caseId: selectedCase.case_id,
          taskId: selectedCase.approval_task_id,
          approved: approvalData.approved,
          outcome: approvalData.final_outcome,
          notes: approvalData.supervisor_notes
        });
        
        // Remove the processed case from the list
        setAllCases((prev: CaseForSupervisor[]) => prev.filter((c: CaseForSupervisor) => c.case_id !== selectedCase.case_id));
        
        console.log(`Case ${selectedCase.case_id} ${approvalData.approved ? 'approved' : 'rejected'} successfully`);
        
      } else {
        // This is a case closure initiated by supervisor - use case service
        if (!approvalData.approved) {
          throw new Error('Cannot reject a case closure when closing a case. Please use a different outcome.');
        }
        
        const closeCaseData: CloseCaseDto = {
          recommendedOutcome: approvalData.final_outcome || 'STATUS_83_CLOSED_INCONCLUSIVE',
          finalNotes: approvalData.supervisor_notes || selectedCase.final_notes || 'Case closed by supervisor',
          recommendations: selectedCase.recommendations || 'Supervisor initiated case closure'
        };

        const response = await caseService.closeCase(selectedCase.case_id, closeCaseData);
        
        console.log(`Case ${selectedCase.case_id} closed successfully by supervisor:`, response);
        
        // Update the case in the local state with the actual response data
        setAllCases((prev: CaseForSupervisor[]) => 
          prev.map((c: CaseForSupervisor) => 
            c.case_id === selectedCase.case_id 
              ? { 
                  ...c, 
                  status: response.closed_case.status,
                  updated_at: new Date(response.closed_case.updated_at),
                  approval_task_id: response.approval_task.task_id,
                  recommended_outcome: closeCaseData.recommendedOutcome,
                  final_notes: closeCaseData.finalNotes,
                  recommendations: closeCaseData.recommendations
                }
              : c
          )
        );
        
        console.log(`Case ${selectedCase.case_id} closed and submitted for approval`);
      }
      
      setShowApprovalModal(false);
      setSelectedCase(null);
      
    } catch (error) {
      console.error('Failed to process case action:', error);
      // Re-throw the error so the modal can handle it
      throw error;
    }
  };

  const handleAssignSubmit = (row: any, assignee: string, justification?: string) => {
    console.log('Assigning case:', row.id, 'to:', assignee, 'reason:', justification);
    setShowAssignModal(false);
  };

  return (
    <PageContainer
      title="Supervisor Dashboard"
      subtitle="Review and approve case closures submitted by investigators"
      actions={
        <button 
          onClick={handleCreateCase} 
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Create Case
        </button>
      }
    >
      {/* Filters */}
      <Card className="bg-indigo-50/40" padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row">
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
                <option value="STATUS_22_PENDING_FINAL_APPROVAL">Pending Approval</option>
                <option value="STATUS_81_CLOSED_REFUTED">Closed - Refuted</option>
                <option value="STATUS_82_CLOSED_CONFIRMED">Closed - Confirmed</option>
                <option value="STATUS_83_CLOSED_INCONCLUSIVE">Closed - Inconclusive</option>
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
                placeholder="Search cases..."
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

      {/* Cases Table */}
      <Card className="mt-4">
        {isLoading ? (
          <SupervisorCasesTableSkeleton rows={8} />
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-red-600">Error loading cases: {error.message}</div>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-500">No cases pending approval</div>
          </div>
        ) : (
          <SupervisorCasesTable 
            cases={filteredCases}
            onReview={handleReview}
            onApprove={handleApprove}
            onAssign={handleAssign}
            onCloseCase={handleCloseCase}
          />
        )}
      </Card>

      {/* Modals */}
      <CreateCaseModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCaseSubmit}
      />

      <ViewCaseModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        row={selectedCase ? {
          id: selectedCase.case_id,
          type: selectedCase.case_type,
          typeColor: 'bg-blue-100 text-blue-800',
          status: selectedCase.status,
          statusColor: 'bg-yellow-100 text-yellow-800',
          typologyId: selectedCase.alert?.alert_id || 'N/A',
          score: selectedCase.alert?.confidence_per || 0,
          createdOn: new Date(selectedCase.created_at).toLocaleDateString(),
          pickedOn: new Date(selectedCase.updated_at).toLocaleDateString(),
          action: 'View' as const,
          reassignEnabled: true,
          assignee: selectedCase.investigator_name || selectedCase.owner_name || 'Unassigned',
          priority: selectedCase.priority,
          userRole: 'owner' as const,
          totalTasks: 0,
          alertId: selectedCase.alert?.alert_id,
          alertMessage: selectedCase.alert?.message,
          confidencePercent: selectedCase.alert?.confidence_per
        } : null}
      />

      <AssignCaseModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onAssign={handleAssignSubmit}
        row={selectedCase ? {
          id: selectedCase.case_id,
          type: selectedCase.case_type,
          typeColor: 'bg-blue-100 text-blue-800',
          status: selectedCase.status,
          statusColor: 'bg-yellow-100 text-yellow-800',
          typologyId: selectedCase.alert?.alert_id || 'N/A',
          score: selectedCase.alert?.confidence_per || 0,
          createdOn: new Date(selectedCase.created_at).toLocaleDateString(),
          pickedOn: new Date(selectedCase.updated_at).toLocaleDateString(),
          action: 'View' as const,
          reassignEnabled: true,
          assignee: selectedCase.investigator_name || selectedCase.owner_name || 'Unassigned',
          priority: selectedCase.priority,
          userRole: 'owner' as const,
          totalTasks: 0,
          alertId: selectedCase.alert?.alert_id,
          alertMessage: selectedCase.alert?.message,
          confidencePercent: selectedCase.alert?.confidence_per
        } : null}
      />

      <ApproveCaseClosureModal
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        case={selectedCase}
        onSubmit={handleApprovalSubmit}
      />
    </PageContainer>
  );
};

export default SupervisorDashboard;
