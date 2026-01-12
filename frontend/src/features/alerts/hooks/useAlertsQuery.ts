import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { useMemo } from 'react';
import triageService from '../services/triageservice';
import { useNotifications } from '../../../shared/providers/NotificationProvider';
import { transformBackendAlertToUI } from '../utils/alertTransformers';
import type { Alert, AlertsFilter, ManualTriageDto } from '../types/triage.types';
import type { AlertStatus } from '../types/triage.types';

export const alertsQueryKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertsQueryKeys.all, 'list'] as const,
  list: (filters: AlertsFilter) => [...alertsQueryKeys.lists(), filters] as const,
  details: () => [...alertsQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...alertsQueryKeys.details(), id] as const,
  actionHistory: (id: number) => [...alertsQueryKeys.detail(id), 'actionHistory'] as const,
  filterOptions: () => [...alertsQueryKeys.all, 'filterOptions'] as const,
};

export const useAlerts = (filters: AlertsFilter = {}) => {
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
    staleTime: 30000,
    gcTime: 300000,
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

export const useAlertDetails = (alertId: number | null) => {
  const {
    data: alert,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: alertsQueryKeys.detail(alertId!),
    queryFn: () => triageService.getAlertById(alertId!),
    enabled: !!alertId,
    staleTime: 60000,
  });

  return {
    alert,
    isLoading,
    error: error as Error | null,
    refetch,
  };
};

export const useAlertActionHistory = (alertId: number | null) => {
  const {
    data: actionHistory,
    isLoading,
    error,
  } = useQuery({
    queryKey: alertsQueryKeys.actionHistory(alertId!),
    queryFn: () => triageService.getAlertActionHistory(alertId!),
    enabled: !!alertId,
    staleTime: 30000,
  });

  return {
    actionHistory: actionHistory || [],
    isLoading,
    error: error as Error | null,
  };
};

export const useAlertOperations = () => {
  const queryClient = useQueryClient();
  const { showError } = useNotifications();

  const closeAlertMutation = useMutation({
    mutationFn: ({ alertId, status, notes }: { alertId: number; status: AlertStatus; notes: string }) =>
      triageService.closeAlert(alertId, status, notes),
    onSuccess: (data, variables) => {
      // showSuccess('Alert closed successfully');
      queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      queryClient.setQueryData(
        alertsQueryKeys.detail(variables.alertId),
        (oldData: Alert | undefined) => oldData ? { ...oldData, ...data } : data
      );

      const caseId = data.case_id ||
        queryClient.getQueryData<Alert>(alertsQueryKeys.detail(variables.alertId))?.case_id;
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      }
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to close alert');
    },
  });

  const updateAlertMutation = useMutation({
    mutationFn: ({ alertId, data }: { alertId: number; data: Record<string, unknown> }) =>
      triageService.updateAlert(alertId, data),
      onSuccess: (data, variables) => {
      // showSuccess('Alert updated successfully');
      // Invalidate all alert lists to refetch with latest data
       console.log('Failed to refresh case data:');
      queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      // Refetch the specific alert detail
      queryClient.invalidateQueries({ queryKey: alertsQueryKeys.detail(variables.alertId) });
      queryClient.setQueryData(
        alertsQueryKeys.detail(variables.alertId),
        (oldData: Alert | undefined) => oldData ? { ...oldData, ...data } : data
      );

      const caseId = data.case_id ||
        queryClient.getQueryData<Alert>(alertsQueryKeys.detail(variables.alertId))?.case_id;
      if (caseId) {
        queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      }
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to update alert');
    },
  });

  const manualTriageMutation = useMutation({
    mutationFn: ({ alertId, data }: { alertId: number; data: ManualTriageDto }) =>
      triageService.performManualTriage(alertId, data),
    onSuccess: (data, variables) => {
      // showSuccess('Manual triage completed successfully');
      queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      queryClient.setQueryData(
        alertsQueryKeys.detail(variables.alertId),
        (oldData: Alert | undefined) => oldData ? { ...oldData, ...data } : data
      );
    },
    onError: (error: Error) => {
      showError(error.message || 'Failed to complete manual triage');
    },
  });

  return {
    closeAlert: closeAlertMutation.mutate,
    updateAlert: updateAlertMutation.mutate,
    performManualTriage: manualTriageMutation.mutate,
    isClosingAlert: closeAlertMutation.isPending,
    isUpdatingAlert: updateAlertMutation.isPending,
    isPerformingManualTriage: manualTriageMutation.isPending,
    operationStates: {
      closingAlert: new Set(closeAlertMutation.isPending ? ['pending'] : []),
      updatingAlert: new Set(updateAlertMutation.isPending ? ['pending'] : []),
      performingManualTriage: new Set(manualTriageMutation.isPending ? ['pending'] : []),
      loadingDetails: new Set([]),
    },
  };
};

export const useAlertFilterOptions = () => {
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
