import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReferenceResultsTable from '../ReferenceResultsTable';
import type { ReferenceIdsData } from '../../types/admindashboard.types';

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

const mockData: ReferenceIdsData[] = [
  { id: 1, txTp: 'pacs.008', referenceIdName: 'REF-001', createdAt: '2024-01-15' },
  { id: 2, txTp: 'pacs.002', referenceIdName: 'REF-002', createdAt: '2024-02-20' },
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

describe('ReferenceResultsTable', () => {
  it('renders table headers', () => {
    render(<ReferenceResultsTable data={mockData} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('txTp')).toBeInTheDocument();
    expect(screen.getByText('Reference ID')).toBeInTheDocument();
    expect(screen.getByText('Created at')).toBeInTheDocument();
  });

  it('renders data rows correctly', () => {
    render(<ReferenceResultsTable data={mockData} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('pacs.008')).toBeInTheDocument();
    expect(screen.getByText('REF-001')).toBeInTheDocument();
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('pacs.002')).toBeInTheDocument();
    expect(screen.getByText('REF-002')).toBeInTheDocument();
    expect(screen.getByText('2024-02-20')).toBeInTheDocument();
  });

  it('shows empty state message when data is empty', () => {
    render(<ReferenceResultsTable data={[]} />);
    expect(
      screen.getByText('No reference records found matching your search criteria.'),
    ).toBeInTheDocument();
  });

  it('does not show empty state when data is present', () => {
    render(<ReferenceResultsTable data={mockData} />);
    expect(
      screen.queryByText('No reference records found matching your search criteria.'),
    ).not.toBeInTheDocument();
  });

  it('renders pagination when provided', () => {
    render(<ReferenceResultsTable data={mockData} pagination={mockPagination} />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('does not render pagination when not provided', () => {
    render(<ReferenceResultsTable data={mockData} />);
    expect(screen.queryByTestId('table-pagination')).not.toBeInTheDocument();
  });

  it('renders single row correctly', () => {
    const singleItem: ReferenceIdsData[] = [
      { id: 99, txTp: 'pain.001', referenceIdName: 'SINGLE-REF', createdAt: '2024-03-01' },
    ];
    render(<ReferenceResultsTable data={singleItem} />);
    expect(screen.getByText('99')).toBeInTheDocument();
    expect(screen.getByText('pain.001')).toBeInTheDocument();
    expect(screen.getByText('SINGLE-REF')).toBeInTheDocument();
  });

  it('renders with empty pagination and data', () => {
    render(<ReferenceResultsTable data={[]} pagination={mockPagination} />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
    expect(
      screen.getByText('No reference records found matching your search criteria.'),
    ).toBeInTheDocument();
  });
});
