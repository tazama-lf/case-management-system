import { useState, useMemo } from 'react';
import type { WorkQueue } from '../types/admindashboard.types';

export const useWorkQueueFilter = (workQueues: WorkQueue[]) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQueues = useMemo(() => {
    return workQueues.filter(queue => {
      const matchesSearch = queue.name.toLowerCase().includes(searchTerm.toLowerCase()) 
      return matchesSearch;
    });
  }, [workQueues, searchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    filteredQueues
  };
};