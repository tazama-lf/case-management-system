import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDashboard from '../AdminDashboard';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAddReference = vi.fn();
const mockOnPageChange = vi.fn();
const mockOnPageSizeChange = vi.fn();

const defaultHookReturn = {
  results: [] as any[],
  loading: false,
  pagination: { currentPage: 1, pageSize: 10, totalItems: 0 },
  fetchReferences: vi.fn(),
  addReference: mockAddReference,
  onPageChange: mockOnPageChange,
  onPageSizeChange: mockOnPageSizeChange,
};

vi.mock('../../hooks/useReferences', () => ({
  useReferenceLookup: () => defaultHookReturn,
}));

vi.mock('@/shared/components/ui', () => ({
  PageContainer: ({ children, title, className }: any) => (
    <div className={className}>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('@/shared/components/ui/ResultsSummary', () => ({
  default: ({ pagination, onPageSizeChange }: any) => (
    <div data-testid="results-summary">
      <span data-testid="total-items">{pagination.totalItems}</span>
      <button data-testid="page-size-btn" onClick={() => onPageSizeChange(25)}>
        Change Page Size
      </button>
    </div>
  ),
}));

vi.mock('../../components/ReferenceResultsTable', () => ({
  default: ({ data, pagination }: any) => (
    <div data-testid="reference-results-table">
      <span data-testid="table-row-count">{data.length}</span>
      {pagination?.onPageChange && (
        <button data-testid="next-page-btn" onClick={() => pagination.onPageChange(2)}>
          Next Page
        </button>
      )}
    </div>
  ),
}));

const mockResults = [
  { id: 1, txTp: 'pacs.002.001.12', referenceIdName: 'EndToEndId', createdAt: '2026-01-01' },
  { id: 2, txTp: 'pacs.008.001.10', referenceIdName: 'InstrId', createdAt: '2026-01-02' },
];

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultHookReturn.results = [];
    defaultHookReturn.loading = false;
    defaultHookReturn.pagination = { currentPage: 1, pageSize: 10, totalItems: 0 };
  });

  it('renders dashboard title', () => {
    render(<AdminDashboard />);
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('renders the Add Reference section with heading and description', () => {
    render(<AdminDashboard />);
    expect(screen.getByRole('heading', { name: 'Add Reference' })).toBeInTheDocument();
    expect(
      screen.getByText(/Enter the Transaction Type and System Reference ID/),
    ).toBeInTheDocument();
  });

  it('renders Transaction Type and System Reference ID input fields', () => {
    render(<AdminDashboard />);
    expect(screen.getByPlaceholderText('Transaction Type')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('System Reference ID')).toBeInTheDocument();
  });

  it('renders add reference button', () => {
    render(<AdminDashboard />);
    expect(screen.getByRole('button', { name: /Add Reference/i })).toBeInTheDocument();
  });

  it('disables add button when both inputs are empty', () => {
    render(<AdminDashboard />);
    const button = screen.getByRole('button', { name: /Add Reference/i });
    expect(button).toBeDisabled();
  });

  it('disables add button when only transaction type is filled', () => {
    render(<AdminDashboard />);
    fireEvent.change(screen.getByPlaceholderText('Transaction Type'), {
      target: { value: 'pacs.002.001.12' },
    });
    expect(screen.getByRole('button', { name: /Add Reference/i })).toBeDisabled();
  });

  it('disables add button when only reference ID is filled', () => {
    render(<AdminDashboard />);
    fireEvent.change(screen.getByPlaceholderText('System Reference ID'), {
      target: { value: 'EndToEndId' },
    });
    expect(screen.getByRole('button', { name: /Add Reference/i })).toBeDisabled();
  });

  it('enables add button when both inputs are filled', () => {
    render(<AdminDashboard />);
    fireEvent.change(screen.getByPlaceholderText('Transaction Type'), {
      target: { value: 'pacs.002.001.12' },
    });
    fireEvent.change(screen.getByPlaceholderText('System Reference ID'), {
      target: { value: 'EndToEndId' },
    });
    expect(screen.getByRole('button', { name: /Add Reference/i })).not.toBeDisabled();
  });

  it('calls addReference and clears inputs on submit', async () => {
    mockAddReference.mockResolvedValue(undefined);
    render(<AdminDashboard />);

    const txnInput = screen.getByPlaceholderText('Transaction Type');
    const refInput = screen.getByPlaceholderText('System Reference ID');

    fireEvent.change(txnInput, { target: { value: 'pacs.002.001.12' } });
    fireEvent.change(refInput, { target: { value: 'EndToEndId' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Reference/i }));

    await waitFor(() => {
      expect(mockAddReference).toHaveBeenCalledWith('pacs.002.001.12', 'EndToEndId');
    });

    await waitFor(() => {
      expect(txnInput).toHaveValue('');
      expect(refInput).toHaveValue('');
    });
  });

  it('shows loading spinner when loading is true', () => {
    defaultHookReturn.loading = true;
    render(<AdminDashboard />);
    expect(screen.getByText('Loading reference records...')).toBeInTheDocument();
  });

  it('does not show results table or empty state while loading', () => {
    defaultHookReturn.loading = true;
    render(<AdminDashboard />);
    expect(screen.queryByTestId('reference-results-table')).not.toBeInTheDocument();
    expect(screen.queryByText('No reference records found.')).not.toBeInTheDocument();
  });

  it('shows empty state when no results and not loading', () => {
    defaultHookReturn.results = [];
    defaultHookReturn.loading = false;
    render(<AdminDashboard />);
    expect(screen.getByText('No reference records found.')).toBeInTheDocument();
  });

  it('renders results table when results exist', () => {
    defaultHookReturn.results = mockResults;
    defaultHookReturn.pagination = { currentPage: 1, pageSize: 10, totalItems: 2 };
    render(<AdminDashboard />);
    expect(screen.getByTestId('reference-results-table')).toBeInTheDocument();
    expect(screen.getByTestId('table-row-count')).toHaveTextContent('2');
  });

  it('renders results summary when results exist', () => {
    defaultHookReturn.results = mockResults;
    defaultHookReturn.pagination = { currentPage: 1, pageSize: 10, totalItems: 2 };
    render(<AdminDashboard />);
    expect(screen.getByTestId('results-summary')).toBeInTheDocument();
    expect(screen.getByTestId('total-items')).toHaveTextContent('2');
  });

  it('does not render results summary or table when results are empty', () => {
    render(<AdminDashboard />);
    expect(screen.queryByTestId('results-summary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reference-results-table')).not.toBeInTheDocument();
  });

  it('passes onPageChange to the results table pagination', () => {
    defaultHookReturn.results = mockResults;
    defaultHookReturn.pagination = { currentPage: 1, pageSize: 10, totalItems: 2 };
    render(<AdminDashboard />);
    fireEvent.click(screen.getByTestId('next-page-btn'));
    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });

  it('passes onPageSizeChange to results summary', () => {
    defaultHookReturn.results = mockResults;
    defaultHookReturn.pagination = { currentPage: 1, pageSize: 10, totalItems: 2 };
    render(<AdminDashboard />);
    fireEvent.click(screen.getByTestId('page-size-btn'));
    expect(mockOnPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('updates input values as user types', () => {
    render(<AdminDashboard />);
    const txnInput = screen.getByPlaceholderText('Transaction Type');
    const refInput = screen.getByPlaceholderText('System Reference ID');

    fireEvent.change(txnInput, { target: { value: 'pacs.008' } });
    expect(txnInput).toHaveValue('pacs.008');

    fireEvent.change(refInput, { target: { value: 'InstrId' } });
    expect(refInput).toHaveValue('InstrId');
  });
});
