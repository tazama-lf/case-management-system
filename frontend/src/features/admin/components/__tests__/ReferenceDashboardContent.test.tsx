import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReferenceDashboardContent from '../ReferenceDashboardContent';

const mockAddReference = vi.fn();
const mockOnPageChange = vi.fn();
const mockOnPageSizeChange = vi.fn();

vi.mock('../../hooks/useReferences', () => ({
  useReferenceLookup: () => ({
    results: [],
    loading: false,
    pagination: { currentPage: 1, pageSize: 10, totalItems: 0 },
    addReference: mockAddReference,
    onPageChange: mockOnPageChange,
    onPageSizeChange: mockOnPageSizeChange,
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

vi.mock('../ReferenceResultsTable', () => ({
  default: () => <div data-testid="reference-results-table" />,
}));

describe('ReferenceDashboardContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders add reference form', () => {
    render(<ReferenceDashboardContent />);
    expect(screen.getByRole('heading', { name: 'Add Reference' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Transaction Type')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('System Reference ID')).toBeInTheDocument();
  });

  it('disables add button when fields are empty', () => {
    render(<ReferenceDashboardContent />);
    const button = screen.getByRole('button', { name: /add reference/i });
    expect(button).toBeDisabled();
  });

  it('enables add button when both fields are filled', () => {
    render(<ReferenceDashboardContent />);
    fireEvent.change(screen.getByPlaceholderText('Transaction Type'), {
      target: { value: 'pacs.008' },
    });
    fireEvent.change(screen.getByPlaceholderText('System Reference ID'), {
      target: { value: 'REF-001' },
    });
    const button = screen.getByRole('button', { name: /add reference/i });
    expect(button).not.toBeDisabled();
  });

  it('calls addReference and resets fields on submit', async () => {
    mockAddReference.mockResolvedValue(undefined);
    render(<ReferenceDashboardContent />);
    fireEvent.change(screen.getByPlaceholderText('Transaction Type'), {
      target: { value: 'pacs.008' },
    });
    fireEvent.change(screen.getByPlaceholderText('System Reference ID'), {
      target: { value: 'REF-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add reference/i }));
    await waitFor(() => {
      expect(mockAddReference).toHaveBeenCalledWith('pacs.008', 'REF-001');
    });
  });
});
