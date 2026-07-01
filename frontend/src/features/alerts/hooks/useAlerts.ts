import { useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
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

const getEndOfDay = (date: Date): Date => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getStartOfDay = (date: Date): Date => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getDateRangeForFilter = (
  filters: AlertsSearchFilters,
): { startDate?: string; endDate?: string } => {
  const now = new Date();
  let startDate: Date | undefined;
  let endDate: Date | undefined;

  switch (filters.timeRange) {
    case 'today':
      startDate = getStartOfDay(now);
      endDate = getEndOfDay(now);
      break;
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = getStartOfDay(yesterday);
      endDate = getEndOfDay(yesterday);
      break;
    }
    case 'thisWeek': {
      const day = now.getDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysSinceMonday);
      startDate = getStartOfDay(monday);
      endDate = getEndOfDay(now);
      break;
    }
    case 'last7days':
      startDate = getStartOfDay(new Date(now));
      startDate.setDate(startDate.getDate() - 6);
      endDate = getEndOfDay(now);
      break;
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = getEndOfDay(now);
      break;
    case 'last30days':
      startDate = getStartOfDay(new Date(now));
      startDate.setDate(startDate.getDate() - 29);
      endDate = getEndOfDay(now);
      break;
    case 'last90days':
      startDate = getStartOfDay(new Date(now));
      startDate.setDate(startDate.getDate() - 89);
      endDate = getEndOfDay(now);
      break;
    case 'custom':
      if (filters.customDateRange?.startDate) {
        startDate = getStartOfDay(new Date(filters.customDateRange.startDate));
      }
      if (filters.customDateRange?.endDate) {
        endDate = getEndOfDay(new Date(filters.customDateRange.endDate));
      }
      break;
  }

  return {
    ...(startDate && { startDate: startDate.toISOString() }),
    ...(endDate && { endDate: endDate.toISOString() }),
  };
};

const normalizeSearchQuery = (query: string): string => {
  const alertIdMatch = query.match(/^alert(?:-|_|\s)*(\d+)$/i);
  return alertIdMatch ? alertIdMatch[1] : query;
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Hook return type is inferred
export const useAlerts = () => {
  const [state, dispatch] = useReducer(alertsReducer, initialState);
  const latestFetchId = useRef(0);

  const fetchAlerts = useCallback(async () => {
    const fetchId = latestFetchId.current + 1;
    latestFetchId.current = fetchId;

    dispatch({ type: 'FETCH_START' });
    try {
      const dateRange = getDateRangeForFilter(state.filters);
      const searchQuery = state.filters.query.trim();
      const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
      const filters = {
        page: state.pagination.currentPage,
        limit: state.pagination.pageSize,
        sortBy: String(state.sort.column),
        sortOrder: state.sort.direction,
        ...(normalizedSearchQuery && { search: normalizedSearchQuery }),
        ...(state.filters.source && { source: state.filters.source }),
        ...(state.filters.type && { alertType: state.filters.type }),
        ...(state.filters.priority && { priority: state.filters.priority }),
        ...dateRange,
      };

      const response = await triageService.getAlerts(filters);
      if (fetchId !== latestFetchId.current) {
        return;
      }

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
      if (fetchId !== latestFetchId.current) {
        return;
      }

      dispatch({ type: 'FETCH_FAILURE', payload: errorMessage });
    }
  }, [
    state.pagination.currentPage,
    state.pagination.pageSize,
    state.sort.column,
    state.sort.direction,
    state.filters.query,
    state.filters.source,
    state.filters.type,
    state.filters.priority,
    state.filters.timeRange,
    state.filters.customDateRange,
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

  const setFilters = (filters: Partial<AlertsSearchFilters>): void => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  };

  const setSort = (
    column: keyof Alert | string,
    direction: 'asc' | 'desc',
  ): void => {
    dispatch({ type: 'SET_SORT', payload: { column, direction } });
  };

  const setPage = (page: number): void => {
    dispatch({ type: 'SET_PAGE', payload: page });
  };

  const setPageSize = (pageSize: number): void => {
    dispatch({ type: 'SET_PAGE_SIZE', payload: pageSize });
  };

  const paginatedAlerts = useMemo(() => state.filteredAlerts, [state.filteredAlerts]);

  return {
    ...state,
    pagination: state.pagination,
    paginatedAlerts,
    setFilters,
    setSort,
    setPage,
    setPageSize,
    refreshAlerts: fetchAlerts,
  };
};
