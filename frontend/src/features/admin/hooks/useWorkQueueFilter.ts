import { useState, useMemo } from 'react';
import type { WorkQueue } from '../types/admindashboard.types';

export const useWorkQueueFilter = (
  workQueues: WorkQueue[],
): {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  filteredQueues: WorkQueue[];
} => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');

  const filteredQueues = useMemo(
    () =>
      workQueues.filter((queue) => {
        const matchesSearch = queue.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesStatus =
          statusFilter === 'All Status' || queue.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [workQueues, searchTerm, statusFilter],
  );

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    filteredQueues,
  };
};
