import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkQueueFilter } from '../useWorkQueueFilter';
import type { WorkQueue } from '../../types/admindashboard.types';

const sampleQueues: WorkQueue[] = [
  {
    id: 'queue-1',
    name: 'Investigations',
    description: 'Handles fraud investigations',
    status: 'Active',
    roles: [],
    taskTypes: [],
    caseStatuses: [],
    caseTypes: [],
  },
  {
    id: 'queue-2',
    name: 'Alerts Review',
    description: 'First level alert triage',
    status: 'Inactive',
    roles: [],
    taskTypes: [],
    caseStatuses: [],
    caseTypes: [],
  },
];

describe('useWorkQueueFilter', () => {
  it('returns the full dataset by default', () => {
    const { result } = renderHook(() => useWorkQueueFilter(sampleQueues));

    expect(result.current.filteredQueues).toHaveLength(2);
    expect(result.current.searchTerm).toBe('');
    expect(result.current.statusFilter).toBe('All Status');
  });

  it('filters by a case-insensitive search term', () => {
    const { result } = renderHook(() => useWorkQueueFilter(sampleQueues));

    act(() => {
      result.current.setSearchTerm('alerts');
    });

    expect(result.current.filteredQueues).toHaveLength(1);
    expect(result.current.filteredQueues[0].id).toBe('queue-2');
  });

  it('filters by status when a specific value is selected', () => {
    const { result } = renderHook(() => useWorkQueueFilter(sampleQueues));

    act(() => {
      result.current.setStatusFilter('Active');
    });

    expect(result.current.filteredQueues).toHaveLength(1);
    expect(result.current.filteredQueues[0].id).toBe('queue-1');

    act(() => {
      result.current.setStatusFilter('Inactive');
    });

    expect(result.current.filteredQueues[0].id).toBe('queue-2');
  });
});
