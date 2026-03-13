import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminWorkQueuesTable from '../AdminWorkQueuesTable';
import type { WorkQueue } from '../../types/admindashboard.types';

/* ------------------------------------------------------------------ */
/*  Mock TablePagination                                              */
/* ------------------------------------------------------------------ */

vi.mock('@/shared', () => ({
  TablePagination: ({ pagination, itemLabel }: { pagination: unknown; itemLabel: string }) => (
    <div data-testid="table-pagination">{itemLabel}</div>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const mockQueues: WorkQueue[] = [
  { id: 'WQ-001', name: 'Fraud Queue', type: 'Investigation' },
  { id: 'WQ-002', name: 'AML Queue', type: 'Review' },
];

const mockPagination = {
  currentPage: 1,
  pageSize: 10,
  totalItems: 2,
  totalPages: 1,
  onPageChange: vi.fn(),
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AdminWorkQueuesTable', () => {
  it('renders table headers', () => {
    render(<AdminWorkQueuesTable queues={mockQueues} />);
    expect(screen.getByText('Group ID')).toBeInTheDocument();
    expect(screen.getByText('Group Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('renders queue rows correctly', () => {
    render(<AdminWorkQueuesTable queues={mockQueues} />);
    expect(screen.getByText('WQ-001')).toBeInTheDocument();
    expect(screen.getByText('Fraud Queue')).toBeInTheDocument();
    expect(screen.getByText('Investigation')).toBeInTheDocument();
    expect(screen.getByText('WQ-002')).toBeInTheDocument();
    expect(screen.getByText('AML Queue')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('shows empty state message when no queues', () => {
    render(<AdminWorkQueuesTable queues={[]} />);
    expect(
      screen.getByText('No work queues found matching your search criteria.'),
    ).toBeInTheDocument();
  });

  it('does not show empty state when queues exist', () => {
    render(<AdminWorkQueuesTable queues={mockQueues} />);
    expect(
      screen.queryByText('No work queues found matching your search criteria.'),
    ).not.toBeInTheDocument();
  });

  it('renders pagination when provided', () => {
    render(<AdminWorkQueuesTable queues={mockQueues} pagination={mockPagination} />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('does not render pagination when not provided', () => {
    render(<AdminWorkQueuesTable queues={mockQueues} />);
    expect(screen.queryByTestId('table-pagination')).not.toBeInTheDocument();
  });

  it('renders single queue', () => {
    const single: WorkQueue[] = [{ id: 'ONE', name: 'Single Queue', type: 'Special' }];
    render(<AdminWorkQueuesTable queues={single} />);
    expect(screen.getByText('ONE')).toBeInTheDocument();
    expect(screen.getByText('Single Queue')).toBeInTheDocument();
    expect(screen.getByText('Special')).toBeInTheDocument();
  });

  it('shows both empty state and pagination when empty with pagination', () => {
    render(<AdminWorkQueuesTable queues={[]} pagination={mockPagination} />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
    expect(
      screen.getByText('No work queues found matching your search criteria.'),
    ).toBeInTheDocument();
  });
});
