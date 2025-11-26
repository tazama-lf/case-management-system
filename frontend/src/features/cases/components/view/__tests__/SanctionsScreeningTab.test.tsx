import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SanctionsScreeningTab from '../SanctionsScreeningTab';
import {
  useCaseSanctionsScreenings,
  useCreateSanctionsScreening,
  useDeleteSanctionsScreening,
  useDownloadSanctionsReport,
  useCaseSanctionsStatistics,
} from '../../../hooks/useSanctionsScreening';

vi.mock('../../../hooks/useSanctionsScreening');

describe('SanctionsScreeningTab', () => {
  const mockScreenings = [
    {
      screening_id: 'SCREENING-1',
      screening_date: '2023-01-01T00:00:00Z',
      tool_source: 'OFAC',
      reference_id: 'REF-123',
      disposition: 'PENDING_REVIEW',
      match_count: 2,
      summary: 'Test screening summary',
      uploaded_at: '2023-01-01T00:00:00Z',
      investigator_id: 'user-1',
      investigator_name: 'John Doe',
      file_name: 'screening.pdf',
      file_size: 1024,
      evidence_id: 'EVIDENCE-1',
    },
  ];

  const mockStatistics = {
    total_screenings: 1,
    high_risk_count: 0,
    pending_review_count: 1,
  };

  const mockScreeningsData = {
    screenings: mockScreenings,
    pagination: {
      page: 1,
      totalPages: 1,
      total: 1,
    },
  };

  const mockCreateMutation = {
    mutateAsync: vi.fn(),
    isPending: false,
  };

  const mockDeleteMutation = {
    mutateAsync: vi.fn(),
    isPending: false,
  };

  const mockDownloadMutation = {
    mutateAsync: vi.fn(),
    isPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({
      data: mockScreeningsData,
      isLoading: false,
    });
    (useCaseSanctionsStatistics as vi.Mock).mockReturnValue({
      data: mockStatistics,
    });
    (useCreateSanctionsScreening as vi.Mock).mockReturnValue(mockCreateMutation);
    (useDeleteSanctionsScreening as vi.Mock).mockReturnValue(mockDeleteMutation);
    (useDownloadSanctionsReport as vi.Mock).mockReturnValue(mockDownloadMutation);
  });

  it('renders sanctions screening tab', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);

    expect(screen.getByText('Sanctions Screening')).toBeInTheDocument();
  });

  it('displays statistics', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);

    expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThan(0);
  });

  it('displays loading state', () => {
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({
      data: null,
      isLoading: true,
    });

    render(<SanctionsScreeningTab caseId="CASE-123" />);

    expect(screen.getByText(/Loading screenings/i)).toBeInTheDocument();
  });

  it('displays empty state when no screenings', () => {
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({
      data: { screenings: [], pagination: { page: 1, totalPages: 1, total: 0 } },
      isLoading: false,
    });

    render(<SanctionsScreeningTab caseId="CASE-123" />);

    expect(screen.getByText(/No Sanctions Screenings/i)).toBeInTheDocument();
  });

  it('opens upload modal when upload button is clicked', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);

    const uploadButton = screen.getByText('Upload Screening');
    fireEvent.click(uploadButton);

    expect(screen.getByRole('heading', { name: 'Upload Sanctions Screening' })).toBeInTheDocument();
  });

  it('allows searching screenings', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);

    const searchInput = screen.getByPlaceholderText('Search screenings...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(searchInput).toHaveValue('test');
  });

  it('toggles filters panel', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);

    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    expect(screen.getByText('Disposition')).toBeInTheDocument();
  });

  it('displays screening cards', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);

    expect(screen.getByText('OFAC')).toBeInTheDocument();
    expect(screen.getByText('Test screening summary')).toBeInTheDocument();
  });

  it('opens details modal when view details is clicked', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);

    const viewDetailsButton = screen.getByText('View Details →');
    fireEvent.click(viewDetailsButton);

    expect(screen.getByRole('heading', { name: 'Sanctions Screening Details' })).toBeInTheDocument();
  });

  it('handles filter reset', async () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);

    const filtersButton = screen.getByText('Filters');
    fireEvent.click(filtersButton);

    await waitFor(() => {
      expect(screen.getByText('Disposition')).toBeInTheDocument();
    });

    const dispositionSelects = screen.getAllByRole('combobox');
    if (dispositionSelects.length > 0) {
      fireEvent.change(dispositionSelects[0], { target: { value: 'PENDING_REVIEW' } });

      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);

      // After reset, filters should be cleared
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search screenings...');
        expect(searchInput).toHaveValue('');
      });
    }
  });
});

