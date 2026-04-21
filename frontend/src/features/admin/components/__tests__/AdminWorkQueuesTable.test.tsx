import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminWorkQueuesTable from '../AdminWorkQueuesTable';

vi.mock('@/shared', () => ({
  TablePagination: ({ itemLabel }: { itemLabel: string }) => (
    <div data-testid="table-pagination">{itemLabel}</div>
  ),
}));

describe('AdminWorkQueuesTable', () => {
  const mockQueues = [
    { id: 'q1', name: 'Fraud Team', type: 'candidate' },
    { id: 'q2', name: 'AML Analysts', type: 'candidate' },
  ];

  it('renders table headers', () => {
    render(<AdminWorkQueuesTable queues={mockQueues} />);
    expect(screen.getByText('Group ID')).toBeInTheDocument();
    expect(screen.getByText('Group Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('renders queue rows', () => {
    render(<AdminWorkQueuesTable queues={mockQueues} />);
    expect(screen.getByText('q1')).toBeInTheDocument();
    expect(screen.getByText('Fraud Team')).toBeInTheDocument();
    expect(screen.getByText('q2')).toBeInTheDocument();
    expect(screen.getByText('AML Analysts')).toBeInTheDocument();
  });

  it('shows empty message when no queues', () => {
    render(<AdminWorkQueuesTable queues={[]} />);
    expect(screen.getByText('No work queues found matching your search criteria.')).toBeInTheDocument();
  });

  it('renders pagination when provided', () => {
    const pagination = {
      currentPage: 1,
      pageSize: 10,
      totalItems: 20,
      totalPages: 2,
      onPageChange: vi.fn(),
      onPageSizeChange: vi.fn(),
    };
    render(<AdminWorkQueuesTable queues={mockQueues} pagination={pagination} />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('does not render pagination when not provided', () => {
    render(<AdminWorkQueuesTable queues={mockQueues} />);
    expect(screen.queryByTestId('table-pagination')).not.toBeInTheDocument();
  });
});
