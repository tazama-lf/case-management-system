
import { useReducer, useCallback, useEffect, useMemo } from 'react';
import triageService from '../services/triageservice';
import { transformBackendAlertToUI } from '../utils/alertTransformers';
import type { Alert, AlertsSearchFilters as UIAlertsSearchFilters } from '../types/alertsdashboard.types';

// Helper function to check if date is within time range
const isDateInRange = (dateString: string, timeRange: string, customDateRange?: { startDate: string; endDate: string }) => {
  const date = new Date(dateString);
  const now = new Date();
  
  switch (timeRange) {
    case 'today': {
      return date.toDateString() === now.toDateString();
    }
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return date.toDateString() === yesterday.toDateString();
    }
    case 'last7days': {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return date >= sevenDaysAgo;
    }
    case 'last30days': {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= thirtyDaysAgo;
    }
    case 'last90days': {
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return date >= ninetyDaysAgo;
    }
    case 'thisWeek': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return date >= startOfWeek;
    }
    case 'thisMonth': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= startOfMonth;
    }
    case 'custom': {
      if (customDateRange?.startDate && customDateRange?.endDate) {
        const startDate = new Date(customDateRange.startDate);
        const endDate = new Date(customDateRange.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        return date >= startDate && date <= endDate;
      }
      return true;
    }
    default:
      return true;
  }
};

interface AlertsSearchFilters extends UIAlertsSearchFilters {
    customDateRange?: { startDate: string; endDate: string };
}

// State structure for the hook
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

// Action types for the reducer
type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: { alerts: Alert[]; totalItems: number; totalPages: number; } }
  | { type: 'FETCH_FAILURE'; payload: string }
  | { type: 'SET_FILTERS'; payload: Partial<AlertsSearchFilters> }
  | { type: 'SET_SORT'; payload: { column: keyof Alert | string; direction: 'asc' | 'desc' } }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number }
  | { type: 'APPLY_FILTERS_AND_SORT' };

// Initial state
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
    status: '',
    timeRange: '',
  },
  sort: {
    column: 'lastUpdated',
    direction: 'desc',
  },
  loading: true,
  error: null,
  lastUpdated: null,
};

// Reducer function
const alertsReducer = (state: AlertsState, action: Action): AlertsState => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        allAlerts: action.payload.alerts,
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
      return { ...state, filters: { ...state.filters, ...action.payload }, pagination: { ...state.pagination, currentPage: 1 } };
    case 'SET_SORT':
      return { ...state, sort: action.payload, pagination: { ...state.pagination, currentPage: 1 } };
    case 'SET_PAGE':
      return { ...state, pagination: { ...state.pagination, currentPage: action.payload } };
    case 'SET_PAGE_SIZE':
        return { ...state, pagination: { ...state.pagination, pageSize: action.payload, currentPage: 1 } };
    case 'APPLY_FILTERS_AND_SORT': {
      let filtered = [...state.allAlerts];

      // Text query filter
      if (state.filters.query && state.filters.query.trim() !== '') {
        const q = state.filters.query.trim().toLowerCase();
        filtered = filtered.filter((a: Alert) => {
          const alertId = String(a.alert_id || '').toLowerCase();
          const message = String(a.message || '').toLowerCase();
          const txId = String(a.transactionId || '').toLowerCase();
          const source = String(a.source || '').toLowerCase();
          const type = String(a.alert_type || '').toLowerCase();
          const transactionJson = a.transaction ? JSON.stringify(a.transaction).toLowerCase() : '';
          const networkMap = a.network_map ? JSON.stringify(a.network_map).toLowerCase() : '';

          return (
            alertId.includes(q) ||
            message.includes(q) ||
            txId.includes(q) ||
            source.includes(q) ||
            type.includes(q) ||
            transactionJson.includes(q) ||
            networkMap.includes(q)
          );
        });
      }

      // Source filter
      if (state.filters.source) {
        filtered = filtered.filter(a => (a.source || '').toLowerCase() === state.filters.source.toLowerCase());
      }

      // Type filter
      if (state.filters.type) {
        filtered = filtered.filter(a => (a.alert_type || '').toLowerCase() === state.filters.type.toLowerCase());
      }

      // Priority filter
      if (state.filters.priority) {
        filtered = filtered.filter(a => (a.priority || '').toLowerCase() === state.filters.priority.toLowerCase());
      }

      // Status filter
      if (state.filters.status) {
        filtered = filtered.filter(a => (a.alert_status || '').toLowerCase() === state.filters.status.toLowerCase());
      }

      // Time range filter
      if (state.filters.timeRange) {
        filtered = filtered.filter((alert: Alert) => isDateInRange(alert.createdAt as string, state.filters.timeRange, state.filters.customDateRange));
      }

      // Sorting
      const getValue = (item: Alert, key: string) => {
        const v = item[key as keyof Alert] as unknown;
        if (v === undefined || v === null) return '';
        if (typeof v === 'string') return v.toLowerCase();
        if (typeof v === 'number') return v;
        if (v instanceof Date) return v.getTime();
        return String(v);
      };

      filtered.sort((a: Alert, b: Alert) => {
        const aVal = getValue(a, state.sort.column as string);
        const bVal = getValue(b, state.sort.column as string);

        if (aVal < bVal) return state.sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return state.sort.direction === 'asc' ? 1 : -1;
        return 0;
      });

      return { ...state, filteredAlerts: filtered, pagination: { ...state.pagination, totalItems: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / state.pagination.pageSize)) } };
    }
    default:
      return state;
  }
};

// The custom hook
export const useAlerts = () => {
  const [state, dispatch] = useReducer(alertsReducer, initialState);

  const fetchAlerts = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      // Fetch all alerts. In a real-world scenario with large datasets,
      // filtering and pagination should be done on the server.
      const response = await triageService.getAlerts({ limit: 1000 }); // Fetch a large number to simulate all data
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
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        dispatch({ type: 'FETCH_FAILURE', payload: errorMessage });
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    // This effect will re-run whenever the filters or sorting change
    // and apply them to the `allAlerts` list.
    dispatch({ type: 'APPLY_FILTERS_AND_SORT' });
  }, [state.allAlerts, state.filters, state.sort]);

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

  // Memoize the paginated alerts to prevent re-calculation on every render
  const paginatedAlerts = useMemo(() => {
    const { currentPage, pageSize } = state.pagination;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return state.filteredAlerts.slice(start, end);
  }, [state.filteredAlerts, state.pagination]);


  return {
    ...state,
    paginatedAlerts,
    setFilters,
    setSort,
    setPage,
    setPageSize,
    refreshAlerts: fetchAlerts,
  };
};
