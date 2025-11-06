import { useMemo, useState, useEffect } from 'react';
import type { UnifiedWorkQueueTask } from '../types/flowable.types';

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const useWorkQueuePagination = (tasks: UnifiedWorkQueueTask[]) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalItems = tasks.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Auto-reset to page 1 when current page exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return tasks.slice(start, end);
  }, [tasks, currentPage, pageSize]);

  const pagination: PaginationState = {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    onPageChange: setCurrentPage,
  };

  return {
    pagination,
    paginatedTasks,
    setPageSize,
  };
};
