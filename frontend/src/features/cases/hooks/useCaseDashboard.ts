import { useState, useEffect, useCallback, useRef } from 'react';
import {
  caseService,
  type CaseWithTasksDto,
} from '@/features/cases/services/caseService';
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

// Pagination constants
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_TOTAL_ITEMS = 0;
const DEFAULT_TOTAL_PAGES = 1;

export interface CaseDashboardFilters {
  search: string;
  sortBy: 'recent' | 'oldest';
  statusFilter: string;
  priorityFilter: string;
  sarStrStatusFilter: string;
  slaStateFilter: string;
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
    setSlaStateFilter: React.Dispatch<React.SetStateAction<string>>;
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
  const { params, navigate, location } = useDynamicRoute();

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  // Guards against out-of-order responses: if filters change while a fetch is
  // in flight, a slower earlier request could otherwise resolve after (and
  // overwrite) the result of a newer one - e.g. clearing filters right after
  // selecting one that returns zero results.
  const latestRequestIdRef = useRef(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [backendTotalItems, setBackendTotalItems] =
    useState(DEFAULT_TOTAL_ITEMS);
  const [backendTotalPages, setBackendTotalPages] =
    useState(DEFAULT_TOTAL_PAGES);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');
  const [statusFilter, setStatusFilter] = useState<string>(
    () => new URLSearchParams(location.search).get('status') ?? '',
  );
  const [priorityFilter, setPriorityFilter] = useState<string>(
    () => new URLSearchParams(location.search).get('priority') ?? '',
  );
  const [sarStrStatusFilter, setSarStrStatusFilter] = useState<string>('');
  const [slaStateFilter, setSlaStateFilter] = useState<string>('');
  const [caseTypeFilter, setCaseTypeFilter] = useState<
    'all' | 'draft' | 'closed'
  >('all');

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);

    if (statusFilter) {
      queryParams.set('status', statusFilter);
    } else {
      queryParams.delete('status');
    }

    if (priorityFilter) {
      queryParams.set('priority', priorityFilter);
    } else {
      queryParams.delete('priority');
    }

    const nextSearch = queryParams.toString();
    const currentSearch = location.search.replace(/^\?/u, '');

    if (nextSearch !== currentSearch) {
      navigate(
        { pathname: location.pathname, search: nextSearch },
        { replace: true },
      );
    }
  }, [
    location.pathname,
    location.search,
    navigate,
    priorityFilter,
    statusFilter,
  ]);

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
    latestRequestIdRef.current += 1;
    const requestId = latestRequestIdRef.current;
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
        slaState: slaStateFilter || undefined,
        sortBy: 'updated_at',
        sortOrder: sortBy === 'recent' ? 'desc' : 'asc',
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
        excludeDraft,
        excludeClosed,
        closedOnly,
      });

      // A newer request has since been kicked off (e.g. filters changed again
      // before this one resolved) - drop this response so it can't clobber
      // the more recent one.
      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      const transformedCases = response.cases.map(transformBackendCaseToUI);
      setCases(transformedCases);

      // Update pagination state from backend response
      if (response.pagination) {
        const pagination = response.pagination as {
          total: number;
          totalPages: number;
        };
        setBackendTotalItems(pagination.total);
        setBackendTotalPages(pagination.totalPages);
      }
    } catch {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      setErrorState('Failed to load cases. Please try again.');
      setCases([]);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    statusFilter,
    priorityFilter,
    sarStrStatusFilter,
    slaStateFilter,
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
    const fetchAndViewCase = async (): Promise<void> => {
      if (typeof params === 'object' && 'caseId' in params) {
        const caseId = Number(params.caseId);
        if (caseId) {
          try {
            // Fetch case directly from API to bypass filters
            const caseData = await caseService.getCaseDetails(caseId);
            const transformedCase = transformBackendCaseToUI(
              caseData as unknown as CaseWithTasksDto,
            );
            setSelectedRow(transformedCase);
            setIsViewOpen(true);
          } catch (err) {
            error('Failed to load case details');
            navigate('/cases');
          }
        }
      }
    };

    fetchAndViewCase();
  }, [params, navigate, error]);

  const totalItems = backendTotalItems;
  const totalPages = backendTotalPages;

  // Reset to page 1 when search changes
  useEffect(() => {
    if (debouncedSearch !== search) {
      // Search is still being typed, don't reset page yet
      return;
    }
    setCurrentPage(DEFAULT_PAGE);
  }, [debouncedSearch, search]);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    caseTypeFilter,
    statusFilter,
    priorityFilter,
    sarStrStatusFilter,
    slaStateFilter,
    sortBy,
  ]);

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
    setSlaStateFilter,
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
      slaStateFilter,
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
