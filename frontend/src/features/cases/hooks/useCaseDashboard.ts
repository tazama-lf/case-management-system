import { useState, useEffect, useCallback } from 'react';
import { caseService } from '@/features/cases/services/caseService';
import type { CaseRow } from '@/features/cases/components/casesTable.utils';
import { transformBackendCaseToUI } from '@/features/cases/components/casesTable.utils';
import { useAuth } from '@/features/auth/components/AuthContext';
import { useToast } from '@/shared/providers/ToastProvider';
import { useDynamicRoute } from '@/shared/utils/routeUtils';
import { useCaseActions } from '@/features/cases/hooks';
import type {
  CaseModalState,
  CaseModalActions,
} from '../components/CaseModalsManager';
import useDebounce from '@/shared/hooks/useDebounce';

export interface CaseDashboardFilters {
  search: string;
  sortBy: 'recent' | 'oldest';
  statusFilter: string;
  priorityFilter: string;
  sarStrStatusFilter: string;
  caseTypeFilter: 'all' | 'draft' | 'closed';
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

export const useCaseDashboard = (): {
  dashboardState: CaseDashboardState;
  modalState: CaseModalState;
  dashboardActions: {
    handleView: (row: CaseRow) => void;
    handleComplete: (row: CaseRow) => void;
    handleCloseCase: (row: CaseRow) => void;
    handleReopenCase: (row: CaseRow) => void;
    handleAbandonCase: (row: CaseRow) => void;
    handleSuspendCase: (row: CaseRow) => void;
    handleResumeCase: (row: CaseRow) => void;
    handleRejectCase: (row: CaseRow) => void;
    handleApproveCase: (row: CaseRow) => void;
    handleApproveCaseCreation: (row: CaseRow) => void;
    handleRejectCaseCreation: (row: CaseRow) => void;
    handleApproveCaseReopen: (row: CaseRow) => void;
    handleRejectCaseReopen: (row: CaseRow) => void;
    handleCreateNew: () => void;
  };
  filterActions: {
    setSearch: React.Dispatch<React.SetStateAction<string>>;
    setSortBy: React.Dispatch<React.SetStateAction<'recent' | 'oldest'>>;
    setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
    setPriorityFilter: React.Dispatch<React.SetStateAction<string>>;
    setSarStrStatusFilter: React.Dispatch<React.SetStateAction<string>>;
    setCaseTypeFilter: React.Dispatch<
      React.SetStateAction<'all' | 'draft' | 'closed'>
    >;
  };
  modalActions: CaseModalActions;
  caseActions: ReturnType<typeof useCaseActions>;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  refreshCases: () => Promise<void>;
} => {
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
  const [sarStrStatusFilter, setSarStrStatusFilter] = useState<string>('');
  const [caseTypeFilter, setCaseTypeFilter] = useState<
    'all' | 'draft' | 'closed'
  >('all');

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- 500ms debounce delay is a standard UX pattern
  const debouncedSearch = useDebounce(search, 500);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUpdateAlertOpen, setIsUpdateAlertOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isCloseCaseOpen, setIsCloseCaseOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [isAbandonOpen, setIsAbandonOpen] = useState(false);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [isCaseClosureDecisionOpen, setIsCaseClosureDecisionOpen] =
    useState(false);
  const [isApproveCreationOpen, setIsApproveCreationOpen] = useState(false);
  const [isRejectCreationOpen, setIsRejectCreationOpen] = useState(false);
  const [isApproveReopenOpen, setIsApproveReopenOpen] = useState(false);
  const [isRejectReopenOpen, setIsRejectReopenOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CaseRow | null>(null);
  const [createModalMode, setCreateModalMode] = useState<'create' | 'edit'>(
    'create',
  );
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [createCaseLoading, setCreateCaseLoading] = useState(false);
  const [createCaseError, setCreateCaseError] = useState<string>('');

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setErrorState(null);

    try {
      let finalStatusFilter = statusFilter;
      let excludeDraft = false;
      let excludeClosed = false;
      let closedOnly = false;

      if (caseTypeFilter === 'draft') {
        finalStatusFilter = 'STATUS_00_DRAFT';
      } else if (caseTypeFilter === 'closed') {
        if (!statusFilter) {
          closedOnly = true;
          finalStatusFilter = '';
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Explicit check for 'all' improves code readability
      } else if (caseTypeFilter === 'all') {
        if (!statusFilter) {
          excludeDraft = true;
          excludeClosed = true;
          finalStatusFilter = '';
        }
      }

      const response = await caseService.getAllCases({
        status: finalStatusFilter || undefined,
        priority: priorityFilter || undefined,
        sarStrStatus: sarStrStatusFilter || undefined,
        sortBy: 'updated_at',
        sortOrder: sortBy === 'recent' ? 'desc' : 'asc',
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
        excludeDraft,
        excludeClosed,
        closedOnly,
      });

      const transformedCases = response.cases.map(transformBackendCaseToUI);
      setCases(transformedCases);

      // Update pagination state from backend response
      if (response.pagination) {
        const pagination = response.pagination as { total: number; totalPages: number };
        setBackendTotalItems(pagination.total);
        setBackendTotalPages(pagination.totalPages);
      }
    } catch {
      setErrorState('Failed to load cases. Please try again.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [
    statusFilter,
    priorityFilter,
    sarStrStatusFilter,
    sortBy,
    currentPage,
    pageSize,
    debouncedSearch,
    caseTypeFilter,
  ]);

  // Case actions hook
  const caseActions = useCaseActions(fetchCases);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    if (typeof params === 'object' && 'caseId' in params) {
      const caseId = Number(params.caseId);
      if (caseId && cases.length > 0) {
        const caseToView = cases.find((c) => c.id === caseId);
        if (caseToView) {
          setSelectedRow(caseToView);
          setIsViewOpen(true);
        } else {
          navigate('/cases');
        }
      }
    }
  }, [cases, params, navigate, error]);

  const totalItems = backendTotalItems;
  const totalPages = backendTotalPages;

  // Reset to page 1 when search changes
  useEffect(() => {
    if (debouncedSearch !== search) {
      // Search is still being typed, don't reset page yet
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch, search]);

  const paginatedCases = cases;

  const pagination: PaginationState = {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
  };

  const dashboardActions = {
    handleView: (row: CaseRow) => {
      setSelectedRow(row);
      setIsViewOpen(true);

      navigate(`/cases/${row.id}`);
    },

    handleComplete: (row: CaseRow) => {
      setSelectedRow(row);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive check for runtime data from API
      if (row.type === null) {
        setIsUpdateAlertOpen(true);
      } else {
        setCreateModalMode('edit');
        setEditingCaseId(row.id);
        setIsCreateOpen(true);
      }
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
    },
  };

  const filterActions = {
    setSearch,
    setSortBy,
    setStatusFilter,
    setPriorityFilter,
    setSarStrStatusFilter,
    setCaseTypeFilter,
  };

  const modalState: CaseModalState = {
    isCreateOpen,
    isUpdateAlertOpen,
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
    createCaseError,
  };

  const modalActions: CaseModalActions = {
    setIsCreateOpen,
    setIsUpdateAlertOpen,
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
    setCreateCaseError,
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
      priorityFilter,
      sarStrStatusFilter,
      caseTypeFilter,
    },
    pagination,
    permissions: {
      canManageSupervisorActions: supervisorOrAdmin,
      isInvestigatorOnly: investigatorOnly,
    },
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
    refreshCases: fetchCases,
  };
};

export default useCaseDashboard;

