import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WorkQueueManagement from '../WorkQueueManagement';

const mockRefetch = vi.fn();

vi.mock('../../hooks/useCandidateGroups', () => ({
  useCandidateGroups: () => ({
    workQueues: [
      { id: 'q1', name: 'Fraud Team', type: 'candidate' },
      { id: 'q2', name: 'AML Analysts', type: 'candidate' },
    ],
    loading: false,
    error: null,
    pagination: { currentPage: 1, pageSize: 10, totalItems: 2 },
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    refetch: mockRefetch,
  }),
}));

vi.mock('../../hooks/useWorkQueueFilter', () => ({
  useWorkQueueFilter: (queues: any[]) => ({
    searchTerm: '',
    setSearchTerm: vi.fn(),
    filteredQueues: queues,
  }),
}));

vi.mock('@/shared/components/ui', () => ({
  PageContainer: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/shared/components/ui/ResultsSummary', () => ({
  default: () => <div data-testid="results-summary" />,
}));

vi.mock('@/features/admin/components/AdminWorkQueuesTable', () => ({
  default: () => <div data-testid="admin-work-queues-table" />,
}));

vi.mock('../SearchInput', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

vi.mock('../modals/CreateQueueModal', () => ({
  default: ({ open, onClose }: any) =>
    open ? <div data-testid="create-queue-modal"><button onClick={onClose}>Close</button></div> : null,
}));

describe('WorkQueueManagement', () => {
  it('renders work queues section', () => {
    render(<WorkQueueManagement />);
    expect(screen.getByText('Work Queues')).toBeInTheDocument();
    expect(screen.getByText('Create New Queue')).toBeInTheDocument();
  });

  it('opens create queue modal on button click', () => {
    render(<WorkQueueManagement />);
    expect(screen.queryByTestId('create-queue-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Create New Queue'));
    expect(screen.getByTestId('create-queue-modal')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<WorkQueueManagement />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });
});
