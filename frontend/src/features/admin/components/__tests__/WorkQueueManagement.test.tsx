import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkQueueManagement from '../WorkQueueManagement';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkQueues } from '../../hooks/useWorkQueues';
import { useWorkQueueFilter } from '../../hooks/useWorkQueueFilter';
import workQueueService from '../../services/workQueueService';

const mockDelete = vi.fn();
const mockRefetch = vi.fn();

const mockQueues = [
  {
    id: 'queue-1',
    name: 'Investigations',
    description: 'Handles AML alerts',
    roles: ['Analyst'],
    taskTypes: ['Review'],
    status: 'Active',
    taskCount: 10,
  },
];

vi.mock('../../hooks/useWorkQueues', () => ({
  useWorkQueues: vi.fn(),
}));

vi.mock('../../hooks/useWorkQueueFilter', () => ({
  useWorkQueueFilter: vi.fn(),
}));

vi.mock('../../services/workQueueService', () => ({
  __esModule: true,
  default: {
    deleteWorkQueue: vi.fn(),
  },
}));

vi.mock('../WorkQueuesTable', () => ({
  __esModule: true,
  default: ({ queues, onEdit, onDelete }: any) => (
    <div data-testid="work-queues-table">
      <p>rows: {queues.length}</p>
      <button onClick={() => onEdit(queues[0])}>edit-first</button>
      <button onClick={() => onDelete(queues[0]?.id)}>delete-first</button>
    </div>
  ),
}));

vi.mock('../SearchInput', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../StatusFilter', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <select
      data-testid="status-filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="All Status">All</option>
      <option value="Active">Active</option>
    </select>
  ),
}));

describe('WorkQueueManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useWorkQueues.mockReturnValue({
      workQueues: mockQueues,
      loading: false,
      error: null,
      totalPages: 1,
      currentPage: 1,
      total: 1,
      refetch: mockRefetch,
      updateFilters: vi.fn(),
    });

    useWorkQueueFilter.mockReturnValue({
      searchTerm: '',
      setSearchTerm: vi.fn(),
      statusFilter: 'All Status',
      setStatusFilter: vi.fn(),
      filteredQueues: mockQueues,
    });

    (workQueueService.deleteWorkQueue as vi.Mock).mockImplementation(
      mockDelete,
    );
  });

  it('renders an error state and allows retrying when hook returns an error', async () => {
    const retry = vi.fn();
    useWorkQueues.mockReturnValue({
      workQueues: [],
      loading: false,
      error: 'Boom',
      totalPages: 0,
      currentPage: 1,
      total: 0,
      refetch: retry,
      updateFilters: vi.fn(),
    });

    render(<WorkQueueManagement />);

    expect(
      screen.getByText(/Error loading work queues/i),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(retry).toHaveBeenCalled();
  });

  it('passes filtered queues to the table and reacts to delete actions', async () => {
    const user = userEvent.setup();
    (workQueueService.deleteWorkQueue as vi.Mock).mockResolvedValueOnce(
      undefined,
    );

    render(<WorkQueueManagement />);

    expect(screen.getByTestId('work-queues-table')).toHaveTextContent('rows: 1');

    await user.click(screen.getByText('delete-first'));

    await waitFor(() => {
      expect(workQueueService.deleteWorkQueue).toHaveBeenCalledWith('queue-1');
    });
    expect(mockRefetch).toHaveBeenCalled();
  });
});
