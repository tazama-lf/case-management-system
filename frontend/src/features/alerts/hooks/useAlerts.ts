import { useReducer, useCallback, useEffect, useMemo } from 'react';
import triageService from '../services/triageservice';
import { transformBackendAlertToUI } from '../utils/alertTransformers';
import type {
  Alert,
  AlertsSearchFilters as UIAlertsSearchFilters,
} from '../types/alertsdashboard.types';

interface AlertsSearchFilters extends UIAlertsSearchFilters {
  customDateRange?: { startDate: string; endDate: string };
}

interface AlertsState {
  allAlerts: Alert[];
  filteredAlerts: Alert[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
  };
  filters: AlertsSearchFilters;
  sort: {
    column: keyof Alert | string;
    direction: 'asc' | 'desc';
  };
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

type Action =
  | { type: 'FETCH_START' }
  | {
      type: 'FETCH_SUCCESS';
      payload: { alerts: Alert[]; totalItems: number; totalPages: number };
    }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'SET_FILTERS'; payload: Partial<AlertsSearchFilters> }
  | {
      type: 'SET_SORT';
      payload: { column: keyof Alert | string; direction: 'asc' | 'desc' };
    }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number };

const initialState: AlertsState = {
  allAlerts: [],
  filteredAlerts: [],
  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    pageSize: 10,
  },
  filters: {
    query: '',
    source: '',
    type: '',
    priority: '',
    timeRange: '',
  },
  sort: {
    column: 'created_at',
    direction: 'desc',
  },
  loading: true,
  error: null,
  lastUpdated: null,
};

const alertsReducer = (state: AlertsState, action: Action): AlertsState => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        allAlerts: action.payload.alerts,
        filteredAlerts: action.payload.alerts, // Backend already filtered, so allAlerts = filteredAlerts
        pagination: {
          ...state.pagination,
          totalItems: action.payload.totalItems,
          totalPages: action.payload.totalPages,
        },
        lastUpdated: new Date(),
      };
    case 'FETCH_FAILURE':
      return { ...state, loading: false, error: action.payload };
    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
        pagination: { ...state.pagination, currentPage: 1 },
      };
    case 'SET_SORT':
      return {
        ...state,
        sort: action.payload,
        pagination: { ...state.pagination, currentPage: 1 },
      };
    case 'SET_PAGE':
      return {
        ...state,
        pagination: { ...state.pagination, currentPage: action.payload },
      };
    case 'SET_PAGE_SIZE':
      return {
        ...state,
        pagination: {
          ...state.pagination,
          pageSize: action.payload,
          currentPage: 1,
        },
      };
  }
};

export const useAlerts = () => {
  const [state, dispatch] = useReducer(alertsReducer, initialState);

  const fetchAlerts = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      // Build the filters object with proper pagination and sorting
      // Remove search from server-side filters - we'll do client-side search like cases
      const filters = {
        page: state.pagination.currentPage,
        limit: state.pagination.pageSize,
        sortBy: String(state.sort.column),
        sortOrder: state.sort.direction,
        // Remove search from server-side: ...(state.filters.query && { search: state.filters.query }),
        ...(state.filters.source && { source: state.filters.source }),
        ...(state.filters.type && { alertType: state.filters.type }),
        ...(state.filters.priority && { priority: state.filters.priority }),
      };

      const response = await triageService.getAlerts(filters);
      const transformedAlerts = response.alerts.map(transformBackendAlertToUI);
      dispatch({
        type: 'FETCH_SUCCESS',
        payload: {
          alerts: transformedAlerts,
          totalItems: response.pagination.totalItems,
          totalPages: response.pagination.totalPages,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      dispatch({ type: 'FETCH_FAILURE', payload: errorMessage });
    }
  }, [
    state.pagination.currentPage,
    state.pagination.pageSize,
    state.sort.column,
    state.sort.direction,
    state.filters.source,
    state.filters.type,
    state.filters.priority,
  ]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Reset to page 1 when search query changes (similar to cases)
  useEffect(() => {
    if (state.filters.query !== '' && state.pagination.currentPage > 1) {
      setPage(1);
    }
  }, [state.filters.query]);

  const setFilters = (filters: Partial<AlertsSearchFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  };

  const setSort = (column: keyof Alert | string, direction: 'asc' | 'desc') => {
    dispatch({ type: 'SET_SORT', payload: { column, direction } });
  };

  const setPage = (page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  };

  const setPageSize = (pageSize: number) => {
    dispatch({ type: 'SET_PAGE_SIZE', payload: pageSize });
  };

  // Apply client-side search filter (same logic as cases)
  const searchFilteredAlerts = useMemo(() => {
    if (state.filters.query === '') return state.allAlerts;
    return state.allAlerts.filter((alert) =>
      [
        alert.alert_id,
        alert.txtp,
        alert.source,
        alert.message,
        alert.priority,
        alert.alert_type,
        String(alert.confidence_per),
        alert.case_id,
        // Add any additional searchable fields
      ]
        .filter(Boolean) // Remove null/undefined values
        .join(' ')
        .toLowerCase()
        .includes(state.filters.query.toLowerCase()),
    );
  }, [state.allAlerts, state.filters.query]);

  const paginatedAlerts = useMemo(() => {
    // For client-side search: if there's a search query, paginate the filtered results
    if (state.filters.query !== '') {
      const start =
        (state.pagination.currentPage - 1) * state.pagination.pageSize;
      const end = start + state.pagination.pageSize;
      return searchFilteredAlerts.slice(start, end);
    }
    // Otherwise, use backend pagination (no search)
    return state.filteredAlerts;
  }, [
    searchFilteredAlerts,
    state.filteredAlerts,
    state.pagination.currentPage,
    state.pagination.pageSize,
    state.filters.query,
  ]);

  return {
    ...state,
    // Update pagination info based on whether we're doing client-side search
    pagination: {
      ...state.pagination,
      totalItems:
        state.filters.query !== ''
          ? searchFilteredAlerts.length
          : state.pagination.totalItems,
      totalPages:
        state.filters.query !== ''
          ? Math.max(
              1,
              Math.ceil(
                searchFilteredAlerts.length / state.pagination.pageSize,
              ),
            )
          : state.pagination.totalPages,
    },
    paginatedAlerts,
    setFilters,
    setSort,
    setPage,
    setPageSize,
    refreshAlerts: fetchAlerts,
  };
};
