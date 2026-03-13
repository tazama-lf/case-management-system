import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReferenceDashboardContent from '../ReferenceDashboardContent';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockAddReference = vi.fn();
const mockFetchReferences = vi.fn();
const mockOnPageChange = vi.fn();
const mockOnPageSizeChange = vi.fn();

vi.mock('../../hooks/useReferences', () => ({
  useReferenceLookup: () => mockUseReferenceLookup(),
}));

let mockUseReferenceLookup = vi.fn();

vi.mock('@/shared/components/ui', () => ({
  PageContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="page-container" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/shared/components/ui/ResultsSummary', () => ({
  default: ({ itemType }: { itemType: string }) => (
    <div data-testid="results-summary">{itemType}</div>
  ),
}));

vi.mock('../ReferenceResultsTable', () => ({
  default: ({ data }: { data: unknown[] }) => (
    <div data-testid="reference-results-table">
      {data.length} results
    </div>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const defaultHookReturn = {
  results: [],
  loading: false,
  pagination: { currentPage: 1, pageSize: 10, totalItems: 0 },
  fetchReferences: mockFetchReferences,
  addReference: mockAddReference,
  onPageChange: mockOnPageChange,
  onPageSizeChange: mockOnPageSizeChange,
};

const mockResultsData = [
  { id: 1, txTp: 'pacs.008', referenceIdName: 'REF-001', createdAt: '2024-01-15' },
  { id: 2, txTp: 'pacs.002', referenceIdName: 'REF-002', createdAt: '2024-02-20' },
];

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ReferenceDashboardContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddReference.mockResolvedValue(undefined);
    mockUseReferenceLookup = vi.fn().mockReturnValue(defaultHookReturn);
  });

  /* ---------- basic rendering ---------- */

  it('renders the Add Reference card', () => {
    render(<ReferenceDashboardContent />);
    // "Add Reference" appears in heading and button
    const addElements = screen.getAllByText(/Add Reference/i);
    expect(addElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByPlaceholderText('Transaction Type')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('System Reference ID')).toBeInTheDocument();
  });

  it('renders empty results message when no data', () => {
    render(<ReferenceDashboardContent />);
    expect(screen.getByText('No reference records found.')).toBeInTheDocument();
  });

  /* ---------- Add Reference form ---------- */

  it('disables add button when inputs are empty', () => {
    render(<ReferenceDashboardContent />);
    const addBtn = screen.getByRole('button', { name: /add reference/i });
    expect(addBtn).toBeDisabled();
  });

  it('enables add button when both inputs are filled', async () => {
    const user = userEvent.setup();
    render(<ReferenceDashboardContent />);

    await user.type(screen.getByPlaceholderText('Transaction Type'), 'pacs.008');
    await user.type(screen.getByPlaceholderText('System Reference ID'), 'REF-123');

    const addBtn = screen.getByRole('button', { name: /add reference/i });
    expect(addBtn).not.toBeDisabled();
  });

  it('calls addReference and clears inputs on submit', async () => {
    const user = userEvent.setup();
    render(<ReferenceDashboardContent />);

    const txnInput = screen.getByPlaceholderText('Transaction Type');
    const refInput = screen.getByPlaceholderText('System Reference ID');

    await user.type(txnInput, 'pacs.008');
    await user.type(refInput, 'REF-123');
    await user.click(screen.getByRole('button', { name: /add reference/i }));

    await waitFor(() => {
      expect(mockAddReference).toHaveBeenCalledWith('pacs.008', 'REF-123');
    });

    await waitFor(() => {
      expect(txnInput).toHaveValue('');
      expect(refInput).toHaveValue('');
    });
  });

  it('disables button when only txnType is filled', async () => {
    const user = userEvent.setup();
    render(<ReferenceDashboardContent />);

    await user.type(screen.getByPlaceholderText('Transaction Type'), 'pacs.008');

    const addBtn = screen.getByRole('button', { name: /add reference/i });
    expect(addBtn).toBeDisabled();
  });

  /* ---------- loading state ---------- */

  it('shows loading spinner when loading', () => {
    mockUseReferenceLookup.mockReturnValue({
      ...defaultHookReturn,
      loading: true,
    });
    render(<ReferenceDashboardContent />);
    expect(screen.getByText('Loading reference records...')).toBeInTheDocument();
  });

  it('does not show results table or empty message during loading', () => {
    mockUseReferenceLookup.mockReturnValue({
      ...defaultHookReturn,
      loading: true,
    });
    render(<ReferenceDashboardContent />);
    expect(screen.queryByTestId('reference-results-table')).not.toBeInTheDocument();
    expect(screen.queryByText('No reference records found.')).not.toBeInTheDocument();
  });

  /* ---------- results rendering ---------- */

  it('renders results table and summary when data exists', () => {
    mockUseReferenceLookup.mockReturnValue({
      ...defaultHookReturn,
      results: mockResultsData,
      pagination: { currentPage: 1, pageSize: 10, totalItems: 2 },
    });
    render(<ReferenceDashboardContent />);

    expect(screen.getByTestId('reference-results-table')).toBeInTheDocument();
    expect(screen.getByTestId('results-summary')).toBeInTheDocument();
    expect(screen.queryByText('No reference records found.')).not.toBeInTheDocument();
  });

  it('does not show empty message when results exist', () => {
    mockUseReferenceLookup.mockReturnValue({
      ...defaultHookReturn,
      results: mockResultsData,
    });
    render(<ReferenceDashboardContent />);
    expect(screen.queryByText('No reference records found.')).not.toBeInTheDocument();
  });

  /* ---------- input interaction ---------- */

  it('updates txnType input on change', async () => {
    const user = userEvent.setup();
    render(<ReferenceDashboardContent />);

    const input = screen.getByPlaceholderText('Transaction Type');
    await user.type(input, 'test');
    expect(input).toHaveValue('test');
  });

  it('updates referenceId input on change', async () => {
    const user = userEvent.setup();
    render(<ReferenceDashboardContent />);

    const input = screen.getByPlaceholderText('System Reference ID');
    await user.type(input, 'ref-value');
    expect(input).toHaveValue('ref-value');
  });

  /* ---------- PageContainer ---------- */

  it('wraps content in PageContainer', () => {
    render(<ReferenceDashboardContent />);
    expect(screen.getByTestId('page-container')).toBeInTheDocument();
  });
});
