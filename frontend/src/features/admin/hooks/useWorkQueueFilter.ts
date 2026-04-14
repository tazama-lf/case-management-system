import { useState, useMemo } from 'react';
import type { WorkQueue } from '../types/admindashboard.types';

export const useWorkQueueFilter = (
  workQueues: WorkQueue[],
): {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredQueues: WorkQueue[];
} => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQueues = useMemo(
    () =>
      workQueues.filter((queue) => {
        const matchesSearch = queue.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        return matchesSearch;
      }),
    [workQueues, searchTerm],
  );

  return {
    searchTerm,
    setSearchTerm,
    filteredQueues,
  };
};
