import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReferenceResultsTable from '../ReferenceResultsTable';

vi.mock('@/shared', () => ({
  TablePagination: ({ itemLabel }: { itemLabel: string }) => (
    <div data-testid="table-pagination">{itemLabel}</div>
  ),
}));

describe('ReferenceResultsTable', () => {
  const mockData = [
    { id: 1, txTp: 'pacs.008', referenceIdName: 'REF-001', createdAt: '2024-01-01' },
    { id: 2, txTp: 'pacs.002', referenceIdName: 'REF-002', createdAt: '2024-01-02' },
  ];

  it('renders table headers', () => {
    render(<ReferenceResultsTable data={mockData} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('txTp')).toBeInTheDocument();
    expect(screen.getByText('Reference ID')).toBeInTheDocument();
    expect(screen.getByText('Created at')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<ReferenceResultsTable data={mockData} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('pacs.008')).toBeInTheDocument();
    expect(screen.getByText('REF-001')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(<ReferenceResultsTable data={[]} />);
    expect(screen.getByText('No reference records found matching your search criteria.')).toBeInTheDocument();
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
    render(<ReferenceResultsTable data={mockData} pagination={pagination} />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });
});
