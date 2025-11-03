import { useState, useMemo } from 'react';
import type { WorkQueue } from '../types/admindashboard.types';

export const useWorkQueueFilter = (workQueues: WorkQueue[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');

  const filteredQueues = useMemo(() => {
    return workQueues.filter(queue => {
      const matchesSearch = queue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          queue.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All Status' || queue.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [workQueues, searchTerm, statusFilter]);

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    filteredQueues
  };
};