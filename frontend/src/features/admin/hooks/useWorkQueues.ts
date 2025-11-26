import { useState, useEffect, useCallback, useRef } from 'react';
import workQueueService from '../services/workQueueService';
import type {
  WorkQueueResponseDto,
  WorkQueueListResponseDto,
  GetWorkQueuesParams,
} from '../services/workQueueService';
import type { WorkQueue } from '../types/admindashboard.types';

interface UseWorkQueuesResult {
  workQueues: WorkQueue[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  total: number;
  refetch: () => Promise<void>;
  updateFilters: (params: GetWorkQueuesParams) => void;
}

export const useWorkQueues = (
  initialParams?: GetWorkQueuesParams,
): UseWorkQueuesResult => {
  const [workQueues, setWorkQueues] = useState<WorkQueue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    totalPages: 0,
    currentPage: 1,
    total: 0,
  });
  const [filters, setFilters] = useState<GetWorkQueuesParams>(
    initialParams || {},
  );

  const transformWorkQueue = (dto: WorkQueueResponseDto): WorkQueue => {
    return {
      id: dto.workQueueId,
      name: dto.name,
      description: dto.description,
      roles: dto.roles,
      taskTypes: dto.taskTypes,
      status: dto.isActive ? 'Active' : 'Inactive',
      taskCount: dto.taskCount,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      tenantId: dto.tenantId,
      createdByUserId: dto.createdByUserId,
      caseStatuses: undefined,
      caseTypes: undefined,
    };
  };

  const isMountedRef = useRef(true);

  const fetchWorkQueues = useCallback(async () => {
    try {
      if (isMountedRef.current) setLoading(true);
      if (isMountedRef.current) setError(null);

      const response: WorkQueueListResponseDto =
        await workQueueService.getAllWorkQueues(filters);

      const transformedQueues = response.data.map(transformWorkQueue);
      if (isMountedRef.current) setWorkQueues(transformedQueues);

      if (isMountedRef.current)
        setPagination({
          totalPages: response.totalPages,
          currentPage: response.page,
          total: response.total,
        });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch work queues';
      if (isMountedRef.current) setError(errorMessage);
      console.error('Error fetching work queues:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [filters]);

  const updateFilters = useCallback((params: GetWorkQueuesParams) => {
    setFilters((prev) => ({ ...prev, ...params }));
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchWorkQueues();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchWorkQueues]);

  return {
    workQueues,
    loading,
    error,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    total: pagination.total,
    refetch: fetchWorkQueues,
    updateFilters,
  };
};
