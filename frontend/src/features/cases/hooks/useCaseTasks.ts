import { useState, useCallback, useEffect } from 'react';
import { taskService } from '../services/taskService';
import type { TaskForSupervisor } from '../services/taskService';

export const useCaseTasks = (
  caseId?: number,
): {
  tasks: TaskForSupervisor[];
  loading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
} => {
  const [tasks, setTasks] = useState<TaskForSupervisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCaseAndTasks = useCallback(async () => {
    if (!caseId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch tasks and case in parallel
      const [fetchedTasks] = await Promise.all([
        taskService.getTasksByCaseId(caseId),
      ]);

      setTasks(fetchedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  // Initial fetch
  useEffect(() => {
    if (caseId) fetchCaseAndTasks();
  }, [caseId, fetchCaseAndTasks]);

  return {
    tasks,
    loading,
    error,
    fetchTasks: fetchCaseAndTasks, // can call to refresh
  };
};
