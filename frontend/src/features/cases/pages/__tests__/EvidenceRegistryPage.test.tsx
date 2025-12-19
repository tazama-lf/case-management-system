import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the hooks and service before importing the component
vi.mock('../../hooks/useEvidence', () => ({
  useSearchEvidence: vi.fn(),
  useDownloadEvidence: vi.fn(),
  useVerifyEvidence: vi.fn(),
}));

vi.mock('../../services/evidenceService', () => ({
  evidenceService: {
    formatFileSize: vi.fn((bytes) => `${bytes} bytes`),
    searchEvidence: vi.fn(),
  },
}));

import EvidenceRegistryPage from '../EvidenceRegistryPage';
import {
  useSearchEvidence,
  useDownloadEvidence,
  useVerifyEvidence,
} from '../../hooks/useEvidence';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('EvidenceRegistryPage', () => {
  const mockEvidence = [
    {
      evidence_id: 'EVIDENCE-1',
      file_name: 'test.pdf',
      evidence_type: 'SANCTIONS',
      file_size: 1024,
      file_hash: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
      case_id: 'CASE-123',
      uploaded_at: '2024-01-01T00:00:00Z',
      uploader_id: 'user-1',
      uploader_name: 'John Doe',
      verified: false,
      description: 'Test evidence',
      tags: ['tag1', 'tag2', 'tag3', 'tag4'],
      access_level: 'PUBLIC',
    } as any,
  ];

  const mockDownloadMutation = {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  };

  const mockVerifyMutation = {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSearchEvidence as vi.Mock).mockReturnValue({
      data: {
        evidence: mockEvidence,
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
      isLoading: false,
    });
    (useDownloadEvidence as vi.Mock).mockReturnValue(mockDownloadMutation);
    (useVerifyEvidence as vi.Mock).mockReturnValue(mockVerifyMutation);
  });

  it('renders evidence registry page', () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Evidence Registry')).toBeInTheDocument();
    expect(screen.getByText('Search and verify evidence across all cases')).toBeInTheDocument();
  });

  it('displays search input', () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(
      'Search by filename, description, tags, case ID...'
    );
    expect(searchInput).toBeInTheDocument();
  });

  it('allows searching evidence', () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText(
      'Search by filename, description, tags, case ID...'
    );
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(searchInput).toHaveValue('test');
  });

  it('toggles filters panel', async () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    // showFilters starts as true, so we should see "Hide Filters" initially
    // Evidence Type should be visible initially
    await waitFor(() => {
      expect(screen.getByText('Evidence Type')).toBeInTheDocument();
    });

    // Find the button that contains "Hide" and "Filters" text
    const buttons = screen.getAllByRole('button');
    const hideButton = buttons.find(button => {
      const text = button.textContent || '';
      return text.includes('Hide') && text.includes('Filters');
    });
    
    expect(hideButton).toBeDefined();
    if (hideButton) {
      fireEvent.click(hideButton);
    }

    // After clicking, Evidence Type should not be visible
    await waitFor(() => {
      expect(screen.queryByText('Evidence Type')).not.toBeInTheDocument();
    });

    // Button should now show "Show Filters"
    const updatedButtons = screen.getAllByRole('button');
    const showButton = updatedButtons.find(button => {
      const text = button.textContent || '';
      return text.includes('Show') && text.includes('Filters');
    });
    expect(showButton).toBeDefined();
  });

  it('filters by evidence type', async () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    // showFilters starts as true, so Evidence Type should already be visible
    await waitFor(() => {
      expect(screen.getByText('Evidence Type')).toBeInTheDocument();
    });

    // Find the select element by role since label is not properly associated
    const selects = screen.getAllByRole('combobox');
    // Find the select that has the evidence type options (Document, Screenshot, etc.)
    const typeSelect = selects.find(select => {
      const options = Array.from(select.querySelectorAll('option')).map(opt => opt.textContent);
      return options.includes('All Types') && options.includes('Document') && options.includes('Screenshot');
    }) || selects[0];
    
    expect(typeSelect).toBeDefined();
    if (typeSelect) {
      // Use a valid option value from the component
      fireEvent.change(typeSelect, { target: { value: 'DOCUMENT' } });
      expect(typeSelect).toHaveValue('DOCUMENT');
    }
  });

  it('filters by verification status', async () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    // showFilters starts as true, so Verification Status should already be visible
    await waitFor(() => {
      expect(screen.getByText('Verification Status')).toBeInTheDocument();
    });

    // Find the select element by role since label is not properly associated
    const selects = screen.getAllByRole('combobox');
    // The verification status select should be the second one (after evidence type)
    // Find it by checking which select has the "All", "Verified", "Unverified" options
    const verifiedSelect = selects.find(select => {
      const options = Array.from(select.querySelectorAll('option')).map(opt => opt.textContent);
      return options.includes('All') && options.includes('Verified') && options.includes('Unverified');
    }) || selects[1];
    
    expect(verifiedSelect).toBeDefined();
    if (verifiedSelect) {
      fireEvent.change(verifiedSelect, { target: { value: 'true' } });
      expect(verifiedSelect).toHaveValue('true');
    }
  });

  it('displays evidence list', async () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    // The case ID is rendered as "Case: CASE-123"
    expect(screen.getByText(/Case: CASE-123/i)).toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useSearchEvidence as vi.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays empty state when no evidence', () => {
    (useSearchEvidence as vi.Mock).mockReturnValue({
      data: {
        evidence: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
      isLoading: false,
    });

    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    expect(screen.getByText('No evidence found')).toBeInTheDocument();
  });

  it('handles verify button click', () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    const verifyButtons = screen.getAllByTitle('Verify Integrity');
    fireEvent.click(verifyButtons[0]);

    expect(mockVerifyMutation.mutate).toHaveBeenCalled();
  });

  it('handles download button click', () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    const downloadButtons = screen.getAllByTitle('Download');
    fireEvent.click(downloadButtons[0]);

    expect(mockDownloadMutation.mutate).toHaveBeenCalled();
  });

  it('opens evidence details modal on evidence click', () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    const evidenceCard = screen.getByText('test.pdf').closest('[class*="card"]');
    if (evidenceCard) {
      fireEvent.click(evidenceCard);
    }

    expect(screen.getByText('Evidence Details')).toBeInTheDocument();
  });

  it('closes evidence details modal', () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    const evidenceCard = screen.getByText('test.pdf').closest('.card');
    if (evidenceCard) {
      fireEvent.click(evidenceCard);
    }

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(screen.queryByText('Evidence Details')).not.toBeInTheDocument();
  });

  it('displays pagination when multiple pages', () => {
    (useSearchEvidence as vi.Mock).mockReturnValue({
      data: {
        evidence: mockEvidence,
        pagination: {
          total: 50,
          page: 1,
          limit: 20,
          totalPages: 3,
        },
      },
      isLoading: false,
    });

    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('handles pagination navigation', () => {
    (useSearchEvidence as vi.Mock).mockReturnValue({
      data: {
        evidence: mockEvidence,
        pagination: {
          total: 50,
          page: 2,
          limit: 20,
          totalPages: 3,
        },
      },
      isLoading: false,
    });

    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    const previousButton = screen.getByText('Previous');
    expect(previousButton).not.toBeDisabled();

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    // Page state should update
    expect(useSearchEvidence).toHaveBeenCalled();
  });

  it('displays evidence tags', () => {
    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    // Tags are rendered as individual elements
    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('displays verified status icon', () => {
    const verifiedEvidence = [
      {
        ...mockEvidence[0],
        verified: true,
        verification_date: '2024-01-02T00:00:00Z',
        verified_by: 'user-2',
      } as any,
    ];

    (useSearchEvidence as vi.Mock).mockReturnValue({
      data: {
        evidence: verifiedEvidence,
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
    });

    render(<EvidenceRegistryPage />, { wrapper: createWrapper() });

    // Check for verified icon
    const verifiedElements = screen.queryAllByTitle('Verified');
    expect(verifiedElements.length).toBeGreaterThan(0);
  });
});

