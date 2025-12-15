import { useState, useEffect, useMemo, useCallback } from 'react';
import { caseService } from '@/features/cases/services/caseService';
import type { CaseRow } from '@/features/cases/components/casesTable.utils';
import { transformBackendCaseToUI } from '@/features/cases/components/casesTable.utils';
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

export interface CaseDashboardPermissions {
  canManageSupervisorActions: boolean;
  isInvestigatorOnly: boolean;
}

export interface CaseDashboardState {
  cases: CaseRow[];
  loading: boolean;
  errorState: string | null;
  filters: CaseDashboardFilters;
  pagination: PaginationState;
  permissions: CaseDashboardPermissions;
}

export const useCaseDashboard = () => {
  const { hasInvestigatorRole, hasSupervisorRole, hasCMSAdminRole } = useAuth();
  const { error } = useToast();
  const { params, navigate } = useDynamicRoute();

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [backendTotalItems, setBackendTotalItems] = useState(0);
  const [backendTotalPages, setBackendTotalPages] = useState(1);

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
  const [isCaseClosureDecisionOpen, setIsCaseClosureDecisionOpen] = useState(false);
  const [isApproveCreationOpen, setIsApproveCreationOpen] = useState(false);
  const [isRejectCreationOpen, setIsRejectCreationOpen] = useState(false);
  const [isApproveReopenOpen, setIsApproveReopenOpen] = useState(false);
  const [isRejectReopenOpen, setIsRejectReopenOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CaseRow | null>(null);
  const [createModalMode, setCreateModalMode] = useState<'create' | 'edit'>('create');
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [createCaseLoading, setCreateCaseLoading] = useState(false);
  const [createCaseError, setCreateCaseError] = useState<string>('');

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setErrorState(null);

    try {
      const response = await caseService.getAllCases({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        sortBy: 'updated_at',
        sortOrder: sortBy === 'recent' ? 'desc' : 'asc',
        page: currentPage,
        limit: pageSize
      });

      const transformedCases = response.cases.map(transformBackendCaseToUI);
      setCases(transformedCases);

      // Update pagination state from backend response
      if (response.pagination) {
        setBackendTotalItems(response.pagination.total);
        setBackendTotalPages(response.pagination.totalPages);
      }
    } catch {
      setErrorState('Failed to load cases. Please try again.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, sortBy, currentPage, pageSize, hasInvestigatorRole, hasSupervisorRole, hasCMSAdminRole]);

  // Case actions hook
  const caseActions = useCaseActions(fetchCases);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);


  useEffect(() => {
    const caseId = Number(params.caseId);
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


  // Apply search filter on frontend (since backend doesn't have search yet)
  const filteredCases = useMemo(() => {
    if (search === '') return cases;
    return cases.filter((c) =>
      [
        c.id,
        c.type,
        c.status,
        //c.typologyId,
        String(c.score),
        c.createdOn,
        // c.pickedOn,
        // c.assignee || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes((search.toLowerCase()))
    );
  }, [cases, search]);

  // Use backend pagination data when available, otherwise calculate from filtered results
  const totalItems = search === '' ? backendTotalItems : filteredCases.length;
  const totalPages = search === '' ? backendTotalPages : Math.max(1, Math.ceil(filteredCases.length / pageSize));

  // Reset to page 1 if current page exceeds total pages and we're doing client-side pagination
  useEffect(() => {
    if (search !== '' && currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, search]);

  // Use filteredCases directly when backend pagination is active (search is empty)
  // Otherwise use client-side pagination for search results
  const paginatedCases = useMemo(() => {
    if (search === '') {
      return filteredCases; // Backend already paginated the results
    } else {
      // Apply client-side pagination for search results
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      return filteredCases.slice(start, end);
    }
  }, [filteredCases, currentPage, pageSize, search]);

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
      setIsCaseClosureDecisionOpen(true);
    },

    handleApproveCase: (row: CaseRow) => {
      setSelectedRow(row);
      setIsCaseClosureDecisionOpen(true);
    },

    handleApproveCaseCreation: (row: CaseRow) => {
      setSelectedRow(row);
      setIsApproveCreationOpen(true);
    },

    handleRejectCaseCreation: (row: CaseRow) => {
      setSelectedRow(row);
      setIsRejectCreationOpen(true);
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
    isCaseClosureDecisionOpen,
    isApproveCreationOpen,
    isRejectCreationOpen,
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
    setIsCaseClosureDecisionOpen,
    setIsApproveCreationOpen,
    setIsRejectCreationOpen,
    setIsApproveReopenOpen,
    setIsRejectReopenOpen,
    setSelectedRow,
    setCreateModalMode,
    setEditingCaseId,
    setCreateCaseLoading,
    setCreateCaseError
  };


  const supervisorOrAdmin = hasSupervisorRole() || hasCMSAdminRole();
  const investigatorOnly = hasInvestigatorRole() && !supervisorOrAdmin;

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
    pagination,
    permissions: {
      canManageSupervisorActions: supervisorOrAdmin,
      isInvestigatorOnly: investigatorOnly
    }
  };

  return {

    dashboardState,
    modalState,


    dashboardActions,
    filterActions,
    modalActions,
    caseActions,

    // Pagination actions
    setCurrentPage: (page: number) => {
      setCurrentPage(page);
    },
    setPageSize: (size: number) => {
      setPageSize(size);
      setCurrentPage(1); // Reset to first page when changing page size
    },
    refreshCases: fetchCases
  };
};

export default useCaseDashboard;