import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { useMemo } from 'react';
import triageService from '../services/triageservice';
import { useNotifications } from '../../shared/providers/NotificationProvider';
import { transformBackendAlertToUI } from '../utils/alertTransformers';
import type { Alert, AlertsFilter } from '../types/triage.types';
import type { AlertStatus } from '../types/triage.types';

// Query keys for consistent cache management
export const alertsQueryKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertsQueryKeys.all, 'list'] as const,
  list: (filters: AlertsFilter) => [...alertsQueryKeys.lists(), filters] as const,
  details: () => [...alertsQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...alertsQueryKeys.details(), id] as const,
  actionHistory: (id: string) => [...alertsQueryKeys.detail(id), 'actionHistory'] as const,
  filterOptions: () => [...alertsQueryKeys.all, 'filterOptions'] as const,
};

// Enhanced useAlerts hook with React Query
export const useAlerts = (filters: AlertsFilter = {}) => {
  // Debounce search to avoid excessive API calls
  const [debouncedSearch] = useDebounce(filters.search, 300);
  
  const debouncedFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearch,
  }), [filters, debouncedSearch]);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    isError,
  } = useQuery({
    queryKey: alertsQueryKeys.list(debouncedFilters),
    queryFn: () => triageService.getAlerts(debouncedFilters),
    enabled: true,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });

  return {
    alerts: (data?.alerts || []).map(alert => transformBackendAlertToUI(alert)),
    pagination: data?.pagination || {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      pageSize: 10,
    },
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    refetch,
    refreshAlerts: refetch,
  };
};

// Enhanced useAlertDetails hook
export const useAlertDetails = (alertId: string | null) => {
  const {
    data: alert,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: alertsQueryKeys.detail(alertId!),
    queryFn: () => triageService.getAlertById(alertId!),
    enabled: !!alertId,
    staleTime: 60000, // 1 minute
  });

  return {
    alert,
    isLoading,
    error: error as Error | null,
    refetch,
  };
};

// Enhanced useAlertActionHistory hook
export const useAlertActionHistory = (alertId: string | null) => {
  const {
    data: actionHistory,
    isLoading,
    error,
  } = useQuery({
    queryKey: alertsQueryKeys.actionHistory(alertId!),
    queryFn: () => triageService.getAlertActionHistory(alertId!),
    enabled: !!alertId,
    staleTime: 30000, // 30 seconds
  });

  return {
    actionHistory: actionHistory || [],
    isLoading,
    error: error as Error | null,
  };
};

// Enhanced useAlertOperations hook with React Query mutations
export const useAlertOperations = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotifications();

  const closeAlertMutation = useMutation({
    mutationFn: ({ alertId, status, notes }: { alertId: string; status: AlertStatus; notes: string }) =>
      triageService.closeAlert(alertId, status, notes),
    onSuccess: (data, variables) => {
      showSuccess('Alert closed successfully');
      // Invalidate and refetch alerts list
      queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      // Update the specific alert in cache
      queryClient.setQueryData(
        alertsQueryKeys.detail(variables.alertId),
        (oldData: Alert | undefined) => oldData ? { ...oldData, ...data } : data
      );
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to close alert');
    },
  });

  const updateAlertMutation = useMutation({
    mutationFn: ({ alertId, data }: { alertId: string; data: any }) =>
      triageService.updateAlert(alertId, data),
    onSuccess: (data, variables) => {
      showSuccess('Alert updated successfully');
      queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      queryClient.setQueryData(
        alertsQueryKeys.detail(variables.alertId),
        (oldData: Alert | undefined) => oldData ? { ...oldData, ...data } : data
      );
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update alert');
    },
  });

  const convertToCaseMutation = useMutation({
    mutationFn: ({ alertId, data }: { alertId: string; data: any }) =>
      triageService.convertAlertToCase(alertId, data),
    onSuccess: (_, variables) => {
      showSuccess('Alert converted to case successfully');
      queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: alertsQueryKeys.detail(variables.alertId) });
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to convert alert to case');
    },
  });

  return {
    closeAlert: closeAlertMutation.mutate,
    updateAlert: updateAlertMutation.mutate,
    convertToCase: convertToCaseMutation.mutate,
    isClosingAlert: closeAlertMutation.isPending,
    isUpdatingAlert: updateAlertMutation.isPending,
    isConvertingToCase: convertToCaseMutation.isPending,
    // Legacy support for existing components
    operationStates: {
      closingAlert: new Set(closeAlertMutation.isPending ? ['pending'] : []),
      updatingAlert: new Set(updateAlertMutation.isPending ? ['pending'] : []),
      convertingToCase: new Set(convertToCaseMutation.isPending ? ['pending'] : []),
      loadingDetails: new Set([]),
    },
  };
};

// Hook for filter options
export const useAlertFilterOptions = () => {
  // For now, return static filter options since backend doesn't support this endpoint yet
  const filterOptions = {
    priorities: ['NEW', 'URGENT', 'CRITICAL', 'BREACH'],
    alertTypes: ['FRAUD', 'AML', 'FRAUD_AND_AML'],
    sources: ['REST API', 'NATS'],
  };

  return {
    filterOptions,
    isLoading: false,
    error: null,
  };
};
