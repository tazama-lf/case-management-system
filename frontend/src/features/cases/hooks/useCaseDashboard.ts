import { useState, useEffect, useMemo } from 'react';
import { caseService } from '@/features/cases/services/caseService';
import type { CaseRow } from '@/features/cases/components/CasesTable';
import { transformBackendCaseToUI } from '@/features/cases/components/CasesTable';
import { useAuth } from '@/features/auth/components/AuthContext';
import { useToast } from '@/shared/providers/ToastProvider';
import { useDynamicRoute } from '@/shared/utils/routeUtils';
import { useCaseActions } from '@/features/cases/hooks';
import type { CaseModalState, CaseModalActions } from '../components/CaseModalsManager';

export interface CaseDashboardFilters {
  search: string;
  sortBy: 'recent' | 'oldest';
  statusFilter: string;
  priorityFilter: string;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CaseDashboardState {
  cases: CaseRow[];
  loading: boolean;
  errorState: string | null;
  filters: CaseDashboardFilters;
  pagination: PaginationState;
}

export const useCaseDashboard = () => {
  const { hasInvestigatorRole, hasSupervisorRole, hasAdminRole } = useAuth();
  const { error } = useToast();
  const { params, navigate } = useDynamicRoute();

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
 
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
  const [createModalMode, setCreateModalMode] = useState<'create' | 'edit'>('create');
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [createCaseLoading, setCreateCaseLoading] = useState(false);
  const [createCaseError, setCreateCaseError] = useState<string>('');

  // Case actions hook
  const caseActions = useCaseActions(() => fetchCases());

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
        // Fetch all cases for supervisors and admins
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

 
  useEffect(() => {
    const caseId = params.caseId;
    if (caseId && cases.length > 0) {
      const caseToView = cases.find(c => c.id === caseId);
      if (caseToView) {
        setSelectedRow(caseToView);
        setIsViewOpen(true);
      } else {
       
        navigate('/cases');
        error('Case Not Found', `Case with ID ${caseId} was not found or you don't have permission to view it.`);
      }
    }
  }, [cases, params.caseId, navigate, error]);


  const filteredCases = cases.filter((c) =>
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

  // Calculate pagination
  const totalItems = filteredCases.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Get paginated cases
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredCases.slice(start, end);
  }, [filteredCases, currentPage, pageSize]);

  const pagination: PaginationState = {
    currentPage,
    pageSize,
    totalItems,
    totalPages
  };

  
  const dashboardActions = {
    handleView: (row: CaseRow) => {
      setSelectedRow(row);
      setIsViewOpen(true);
     
      navigate(`/cases/${row.id}`);
    },

    handleComplete: (row: CaseRow) => {
      setSelectedRow(row);
      setCreateModalMode('edit');
      setEditingCaseId(row.id);
      setIsCreateOpen(true);
    },

    handleCloseCase: (row: CaseRow) => {
      setSelectedRow(row);
      setIsCloseCaseOpen(true);
    },

    handleReopenCase: (row: CaseRow) => {
      setSelectedRow(row);
      setIsReopenOpen(true);
    },

    handleAbandonCase: (row: CaseRow) => {
      setSelectedRow(row);
      setIsAbandonOpen(true);
    },

    handleSuspendCase: (row: CaseRow) => {
      setSelectedRow(row);
      setIsSuspendOpen(true);
    },

    handleResumeCase: (row: CaseRow) => {
      setSelectedRow(row);
      setIsResumeOpen(true);
    },

    handleRejectCase: (row: CaseRow) => {
      setSelectedRow(row);
      setIsRejectOpen(true);
    },

    handleApproveCase: (row: CaseRow) => {
      setSelectedRow(row);
      setIsApproveOpen(true);
    },

    handleApproveCaseCreation: (row: CaseRow) => {
      setSelectedRow(row);
      setIsApproveCreationOpen(true);
    },

    handleRejectCaseCreation: (row: CaseRow) => {
      setSelectedRow(row);
      setIsRejectCreationOpen(true);
    },

    handleReturnForReview: (row: CaseRow) => {
      setSelectedRow(row);
      setIsReturnForReviewOpen(true);
    },

    handleApproveCaseReopen: (row: CaseRow) => {
      setSelectedRow(row);
      setIsApproveReopenOpen(true);
    },

    handleRejectCaseReopen: (row: CaseRow) => {
      setSelectedRow(row);
      setIsRejectReopenOpen(true);
    },

    handleCreateNew: () => {
      setCreateModalMode('create');
      setEditingCaseId(null);
      setSelectedRow(null);
      setIsCreateOpen(true);
    }
  };

  const filterActions = {
    setSearch,
    setSortBy,
    setStatusFilter,
    setPriorityFilter
  };


  const modalState: CaseModalState = {
    isCreateOpen,
    isViewOpen,
    isCloseCaseOpen,
    isReopenOpen,
    isAbandonOpen,
    isSuspendOpen,
    isResumeOpen,
    isRejectOpen,
    isApproveOpen,
    isApproveCreationOpen,
    isRejectCreationOpen,
    isReturnForReviewOpen,
    isApproveReopenOpen,
    isRejectReopenOpen,
    selectedRow,
    createModalMode,
    editingCaseId,
    createCaseLoading,
    createCaseError
  };

  const modalActions: CaseModalActions = {
    setIsCreateOpen,
    setIsViewOpen,
    setIsCloseCaseOpen,
    setIsReopenOpen,
    setIsAbandonOpen,
    setIsSuspendOpen,
    setIsResumeOpen,
    setIsRejectOpen,
    setIsApproveOpen,
    setIsApproveCreationOpen,
    setIsRejectCreationOpen,
    setIsReturnForReviewOpen,
    setIsApproveReopenOpen,
    setIsRejectReopenOpen,
    setSelectedRow,
    setCreateModalMode,
    setEditingCaseId,
    setCreateCaseLoading,
    setCreateCaseError
  };

  
  const dashboardState: CaseDashboardState = {
    cases: paginatedCases,
    loading,
    errorState,
    filters: {
      search,
      sortBy,
      statusFilter,
      priorityFilter
    },
    pagination
  };

  return {
   
    dashboardState,
    modalState,
    
  
    dashboardActions,
    filterActions,
    modalActions,
    caseActions,
    
    // Pagination actions
    setCurrentPage,
    setPageSize,
    refreshCases: fetchCases
  };
};

export default useCaseDashboard;