import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkQueueManagement from '../WorkQueueManagement';

const mockRefetch = vi.fn();

const mockCandidateGroupsReturn = {
  workQueues: [
    { id: 'q1', name: 'Fraud Team', type: 'candidate' },
    { id: 'q2', name: 'AML Analysts', type: 'candidate' },
  ] as any[],
  loading: false,
  error: null as string | null,
  pagination: { currentPage: 1, pageSize: 10, totalItems: 2 },
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  refetch: mockRefetch,
};

vi.mock('../../hooks/useCandidateGroups', () => ({
  useCandidateGroups: () => mockCandidateGroupsReturn,
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
    open ? (
      <div data-testid="create-queue-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

describe('WorkQueueManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCandidateGroupsReturn.workQueues = [
      { id: 'q1', name: 'Fraud Team', type: 'candidate' },
      { id: 'q2', name: 'AML Analysts', type: 'candidate' },
    ];
    mockCandidateGroupsReturn.loading = false;
    mockCandidateGroupsReturn.error = null;
    mockCandidateGroupsReturn.pagination = {
      currentPage: 1,
      pageSize: 10,
      totalItems: 2,
    };
  });

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

  it('shows loading spinner when loading', () => {
    mockCandidateGroupsReturn.loading = true;
    render(<WorkQueueManagement />);
    expect(
      screen.queryByTestId('admin-work-queues-table'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('results-summary')).not.toBeInTheDocument();
  });

  it('shows error state with retry button', () => {
    mockCandidateGroupsReturn.error = 'Network error';
    render(<WorkQueueManagement />);
    expect(screen.getByText('Error loading work queues')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls refetch when retry button is clicked', async () => {
    mockCandidateGroupsReturn.error = 'Network error';
    render(<WorkQueueManagement />);
    fireEvent.click(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('closes create queue modal', () => {
    render(<WorkQueueManagement />);
    fireEvent.click(screen.getByText('Create New Queue'));
    expect(screen.getByTestId('create-queue-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByTestId('create-queue-modal')).not.toBeInTheDocument();
  });

  it('renders results summary and table when not loading', () => {
    render(<WorkQueueManagement />);
    expect(screen.getByTestId('results-summary')).toBeInTheDocument();
    expect(screen.getByTestId('admin-work-queues-table')).toBeInTheDocument();
  });
});
