import { useState, useEffect, useCallback } from 'react';
import workQueueService from '../services/workQueueService';
import type { WorkQueue } from '../types/admindashboard.types';

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface UseCandidateGroupsParams {
  currentPage?: number;
  pageSize?: number;
}

interface UseCandidateGroupsResult {
  workQueues: WorkQueue[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  refetch: () => Promise<void>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const useCandidateGroups = (
  params?: UseCandidateGroupsParams,
): UseCandidateGroupsResult => {
  const [workQueues, setWorkQueues] = useState<WorkQueue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(params?.currentPage ?? 1);
  const [pageSize, setPageSize] = useState(params?.pageSize ?? 10);
  const [totalItems, setTotalItems] = useState(0);

  const fetchCandidateGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const start = (currentPage - 1) * pageSize;
      const response = await workQueueService.getCandidateGroups({
        size: pageSize,
        start,
      });

      const workQueues: WorkQueue[] = response.items.map((group) => ({
        id: group.id,
        name: group.name,
        type: group.type,
      }));

      setWorkQueues(workQueues);
      setTotalItems(response.totalCount);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch candidate groups';
      setError(errorMessage);
      console.error('Error fetching candidate groups:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchCandidateGroups();
  }, [fetchCandidateGroups]);

  const onPageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    workQueues,
    loading,
    error,
    pagination: {
      currentPage,
      pageSize,
      totalItems,
      totalPages,
    },
    refetch: fetchCandidateGroups,
    onPageChange,
    onPageSizeChange,
  };
};
