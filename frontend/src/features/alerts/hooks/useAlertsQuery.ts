import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { useMemo } from 'react';
import triageService from '../services/triageservice';
import { useNotifications } from '../../../shared/providers/NotificationProvider';
import { transformBackendAlertToUI } from '../utils/alertTransformers';
import type {
  Alert,
  AlertsFilter,
  ManualTriageDto,
  AlertStatus,
  ActionHistory,
} from '../types/triage.types';

export const alertsQueryKeys = {
  all: ['alerts'] as const,
  lists: () => [...alertsQueryKeys.all, 'list'] as const,
  list: (filters: AlertsFilter) =>
    [...alertsQueryKeys.lists(), filters] as const,
  details: () => [...alertsQueryKeys.all, 'detail'] as const,
  detail: (id: number) => [...alertsQueryKeys.details(), id] as const,
  actionHistory: (id: number) =>
    [...alertsQueryKeys.detail(id), 'actionHistory'] as const,
  filterOptions: () => [...alertsQueryKeys.all, 'filterOptions'] as const,
};

export const useAlerts = (
  filters: AlertsFilter = {},
): {
  alerts: Alert[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
  };
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
} => {
  const [debouncedSearch] = useDebounce(filters.search, 300);

  const debouncedFilters = useMemo(
    () => ({
      ...filters,
      search: debouncedSearch,
    }),
    [filters, debouncedSearch],
  );

  const { data, isLoading, error, refetch, isFetching, isError } = useQuery({
    queryKey: alertsQueryKeys.list(debouncedFilters),
    queryFn: async () => await triageService.getAlerts(debouncedFilters),
    enabled: true,
    staleTime: 30000,
    gcTime: 300000,
  });

  return {
    alerts: (data?.alerts ?? []).map((alert) =>
      transformBackendAlertToUI(alert),
    ),
    pagination: data?.pagination ?? {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      pageSize: 10,
    },
    isLoading,
    isFetching,
    isError,
    error,
    refetch: async () => {
      await refetch();
    },
    refreshAlerts: async () => {
      await refetch();
    },
  };
};

export const useAlertDetails = (
  alertId: number | null,
): {
  alert: Alert | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} => {
  const {
    data: alert,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: alertsQueryKeys.detail(alertId!),
    queryFn: async () => await triageService.getAlertById(alertId!),
    enabled: !!alertId,
    staleTime: 60000,
  });

  return {
    alert,
    isLoading,
    error,
    refetch: (): void => {
      void refetch();
    },
  };
};

export const useAlertActionHistory = (
  alertId: number | null,
): {
  actionHistory: ActionHistory[];
  isLoading: boolean;
  error: Error | null;
} => {
  const {
    data: actionHistory,
    isLoading,
    error,
  } = useQuery({
    queryKey: alertsQueryKeys.actionHistory(alertId!),
    queryFn: async () => await triageService.getAlertActionHistory(alertId!),
    enabled: !!alertId,
    staleTime: 30000,
  });

  return {
    actionHistory: actionHistory ?? [],
    isLoading,
    error,
  };
};

export const useAlertOperations = (): {
  closeAlert: (variables: {
    alertId: number;
    status: AlertStatus;
    notes: string;
  }) => void;
  updateAlert: (variables: {
    alertId: number;
    data: Record<string, unknown>;
  }) => void;
  performManualTriage: (variables: {
    alertId: number;
    data: ManualTriageDto;
  }) => void;
  isClosingAlert: boolean;
  isUpdatingAlert: boolean;
  isPerformingManualTriage: boolean;
  operationStates: {
    closingAlert: Set<string>;
    updatingAlert: Set<string>;
    performingManualTriage: Set<string>;
    loadingDetails: Set<string>;
  };
} => {
  const queryClient = useQueryClient();
  const { showError } = useNotifications();

  const closeAlertMutation = useMutation({
    mutationFn: async ({
      alertId,
      status,
      notes,
    }: {
      alertId: number;
      status: AlertStatus;
      notes: string;
    }) => await triageService.closeAlert(alertId, status, notes),
    onSuccess: (data, variables) => {
      // showSuccess('Alert closed successfully');
      void queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      queryClient.setQueryData(
        alertsQueryKeys.detail(variables.alertId),
        (oldData: Alert | undefined) =>
          oldData ? { ...oldData, ...data } : data,
      );

      const caseId =
        data.case_id ??
        queryClient.getQueryData<Alert>(
          alertsQueryKeys.detail(variables.alertId),
        )?.case_id;
      if (caseId) {
        void queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      }
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const updateAlertMutation = useMutation({
    mutationFn: async ({
      alertId,
      data,
    }: {
      alertId: number;
      data: Record<string, unknown>;
    }) => await triageService.updateAlert(alertId, data),
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      // Refetch the specific alert detail
      void queryClient.invalidateQueries({
        queryKey: alertsQueryKeys.detail(variables.alertId),
      });
      queryClient.setQueryData(
        alertsQueryKeys.detail(variables.alertId),
        (oldData: Alert | undefined) =>
          oldData ? { ...oldData, ...data } : data,
      );

      const caseId =
        data.case_id ??
        queryClient.getQueryData<Alert>(
          alertsQueryKeys.detail(variables.alertId),
        )?.case_id;
      if (caseId) {
        void queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      }
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const manualTriageMutation = useMutation({
    mutationFn: async ({
      alertId,
      data,
    }: {
      alertId: number;
      data: ManualTriageDto;
    }) => await triageService.performManualTriage(alertId, data),
    onSuccess: (data, variables) => {
      // showSuccess('Manual triage completed successfully');
      void queryClient.invalidateQueries({ queryKey: alertsQueryKeys.lists() });
      queryClient.setQueryData(
        alertsQueryKeys.detail(variables.alertId),
        (oldData: Alert | undefined) =>
          oldData ? { ...oldData, ...data } : data,
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
      performingManualTriage: new Set(
        manualTriageMutation.isPending ? ['pending'] : [],
      ),
      loadingDetails: new Set([]),
    },
  };
};

export const useAlertFilterOptions = (): {
  filterOptions: {
    priorities: string[];
    alertTypes: string[];
    sources: string[];
  };
  isLoading: boolean;
  error: null;
} => {
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
