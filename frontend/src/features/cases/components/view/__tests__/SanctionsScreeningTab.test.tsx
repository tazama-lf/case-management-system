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
import { validateScreeningFile } from '../../../services/sanctionsService';

vi.mock('../../../hooks/useSanctionsScreening');
vi.mock('../../../services/sanctionsService', async (importOriginal) => {
  const original: any = await importOriginal();
  return {
    ...original,
    validateScreeningFile: vi.fn().mockReturnValue({ valid: true }),
    formatFileSize: original.formatFileSize,
    getDispositionColor: original.getDispositionColor,
  };
});

describe('SanctionsScreeningTab', () => {
  const mockScreenings = [
    {
      screening_id: 'SCREENING-1',
      screening_date: '2023-01-01T00:00:00Z',
      tool_source: 'WorldCheck',
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
      metadata: {
        entities_screened: 5,
        confidence_score: 85,
        risk_level: 'HIGH',
        watchlists_checked: ['OFAC', 'EU'],
      },
    },
  ];

  const mockStatistics = {
    total_screenings: 1,
    high_risk_count: 0,
    pending_review_count: 1,
  };

  const mockScreeningsData = {
    screenings: mockScreenings,
    pagination: { page: 1, totalPages: 1, total: 1 },
  };

  const mockCreateMutation = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  };

  const mockDeleteMutation = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  };

  const mockDownloadMutation = {
    mutateAsync: vi.fn().mockResolvedValue({}),
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
    (validateScreeningFile as vi.Mock).mockReturnValue({ valid: true });
  });

  // ── Basic Rendering ──

  it('renders sanctions screening tab heading and description', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText('Sanctions Screening')).toBeInTheDocument();
    expect(screen.getByText(/Manage and track sanctions screening reports/)).toBeInTheDocument();
  });

  it('displays statistics with total and pending counts', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText(/Total:/)).toBeInTheDocument();
    expect(screen.getByText(/Pending:/)).toBeInTheDocument();
  });

  it('displays high risk count when greater than zero', () => {
    (useCaseSanctionsStatistics as vi.Mock).mockReturnValue({
      data: { total_screenings: 5, high_risk_count: 3, pending_review_count: 0 },
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText(/High Risk:/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides high risk count when zero', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.queryByText(/High Risk:/)).not.toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({ data: null, isLoading: true });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText(/Loading screenings/i)).toBeInTheDocument();
  });

  it('displays empty state with upload first screening button', () => {
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({
      data: { screenings: [], pagination: { page: 1, totalPages: 1, total: 0 } },
      isLoading: false,
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText(/No Sanctions Screenings/i)).toBeInTheDocument();
    expect(screen.getByText('Upload First Screening')).toBeInTheDocument();
  });

  it('opens upload modal from empty state button', () => {
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({
      data: { screenings: [], pagination: { page: 1, totalPages: 1, total: 0 } },
      isLoading: false,
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload First Screening'));
    expect(screen.getByRole('heading', { name: 'Upload Sanctions Screening' })).toBeInTheDocument();
  });

  // ── Screening Card ──

  it('displays screening card with tool source, summary, and match count', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText('WorldCheck')).toBeInTheDocument();
    expect(screen.getByText('Test screening summary')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays reference ID on screening card', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText(/Ref: REF-123/)).toBeInTheDocument();
  });

  it('displays investigator name on screening card', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it('displays file name on screening card', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText('screening.pdf')).toBeInTheDocument();
  });

  it('displays investigator_id when investigator_name is absent', () => {
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({
      data: {
        screenings: [{ ...mockScreenings[0], investigator_name: undefined }],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
      isLoading: false,
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.getByText(/user-1/)).toBeInTheDocument();
  });

  // ── Search & Filters ──

  it('allows searching screenings', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    const searchInput = screen.getByPlaceholderText('Search screenings...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput).toHaveValue('test');
  });

  it('toggles filters panel open and closed', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    const filtersButton = screen.getByText('Filters');

    fireEvent.click(filtersButton);
    expect(screen.getByText('Disposition')).toBeInTheDocument();
    expect(screen.getByText('Tool/Source')).toBeInTheDocument();

    fireEvent.click(filtersButton);
    expect(screen.queryByText('Disposition')).not.toBeInTheDocument();
  });

  it('changes disposition filter', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Filters'));

    const dispositionSelect = screen.getByDisplayValue('All Dispositions');
    fireEvent.change(dispositionSelect, { target: { value: 'CLEARED' } });
    expect(dispositionSelect).toHaveValue('CLEARED');
  });

  it('changes tool filter', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Filters'));

    const toolSelect = screen.getByDisplayValue('All Tools');
    fireEvent.change(toolSelect, { target: { value: 'WorldCheck' } });
    expect(toolSelect).toHaveValue('WorldCheck');
  });

  it('shows and handles reset button when search has value', async () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    const searchInput = screen.getByPlaceholderText('Search screenings...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => expect(screen.getByText('Reset')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => expect(searchInput).toHaveValue(''));
  });

  // ── Upload Modal ──

  it('opens upload modal from header button', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));
    expect(screen.getByRole('heading', { name: 'Upload Sanctions Screening' })).toBeInTheDocument();
  });

  it('closes upload modal via Cancel button', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));
    expect(screen.getByRole('heading', { name: 'Upload Sanctions Screening' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'Upload Sanctions Screening' })).not.toBeInTheDocument();
  });

  it('handles file selection in upload modal', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText(/report.pdf/)).toBeInTheDocument();
  });

  it('shows file error for invalid file', () => {
    (validateScreeningFile as vi.Mock).mockReturnValue({ valid: false, error: 'Invalid file type' });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'report.exe', { type: 'application/octet-stream' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('Invalid file type')).toBeInTheDocument();
  });

  it('fills out and submits upload form', async () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));

    // Fill required fields
    const toolSelect = screen.getAllByDisplayValue('Select a tool...')[0];
    fireEvent.change(toolSelect, { target: { value: 'WorldCheck' } });

    const summaryTextarea = screen.getByPlaceholderText(/Summarize the screening/);
    fireEvent.change(summaryTextarea, { target: { value: 'Summary of findings' } });

    // Submit form
    const submitButtons = screen.getAllByText('Upload Screening');
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateMutation.mutateAsync).toHaveBeenCalled();
    });
  });

  it('shows validation error when required fields are missing on submit', async () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));

    // Submit the form directly to bypass HTML5 required validation
    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Please fill in all required fields')).toBeInTheDocument();
    });
  });

  it('changes form fields in upload modal', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));

    // Reference ID
    const refInput = screen.getByPlaceholderText('External system reference');
    fireEvent.change(refInput, { target: { value: 'REF-999' } });
    expect(refInput).toHaveValue('REF-999');

    // Match count
    const matchInput = screen.getByDisplayValue('0');
    fireEvent.change(matchInput, { target: { value: '5' } });
    expect(matchInput).toHaveValue(5);

    // Disposition
    const dispSelect = screen.getAllByDisplayValue(/Pending Review/)[0];
    fireEvent.change(dispSelect, { target: { value: 'CLEARED' } });
    expect(dispSelect).toHaveValue('CLEARED');

    // Screening date
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2024-06-15' } });
    expect(dateInput).toHaveValue('2024-06-15');
  });

  it('submits form with advanced metadata fields', async () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));

    // Fill required fields
    const toolSelect = screen.getAllByDisplayValue('Select a tool...')[0];
    fireEvent.change(toolSelect, { target: { value: 'WorldCheck' } });
    const summaryTextarea = screen.getByPlaceholderText(/Summarize the screening/);
    fireEvent.change(summaryTextarea, { target: { value: 'Summary' } });

    // Open advanced metadata
    const detailsSummary = screen.getByText(/Advanced Metadata/);
    fireEvent.click(detailsSummary);
    // Manually set open attribute since JSDOM may not toggle <details>
    const detailsEl = detailsSummary.closest('details');
    if (detailsEl) detailsEl.setAttribute('open', '');

    // Fill entities_screened - labels aren't associated via htmlFor, use DOM queries
    const numberInputs = document.querySelectorAll('input[type="number"]');
    // match_count is first number input, entities_screened and confidence_score are inside details
    const allNumberInputs = Array.from(numberInputs);
    const entitiesInput = allNumberInputs.find((el) => {
      const label = el.closest('div')?.querySelector('label');
      return label?.textContent?.includes('Entities Screened');
    }) as HTMLInputElement;
    fireEvent.change(entitiesInput, { target: { value: '10' } });

    const confidenceInput = allNumberInputs.find((el) => {
      const label = el.closest('div')?.querySelector('label');
      return label?.textContent?.includes('Confidence Score');
    }) as HTMLInputElement;
    fireEvent.change(confidenceInput, { target: { value: '95' } });

    // Fill risk level
    const riskSelect = document.querySelector('details select') as HTMLSelectElement;
    fireEvent.change(riskSelect, { target: { value: 'HIGH' } });

    // Fill watchlists
    const watchlistsInput = screen.getByPlaceholderText('OFAC, EU, UN, etc.');
    fireEvent.change(watchlistsInput, { target: { value: 'OFAC, EU' } });

    // Submit
    const submitButtons = screen.getAllByText('Upload Screening');
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateMutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            entities_screened: 10,
            confidence_score: 95,
            risk_level: 'HIGH',
            watchlists_checked: ['OFAC', 'EU'],
          }),
        }),
      );
    });
  });

  it('handles upload failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateMutation.mutateAsync.mockRejectedValueOnce(new Error('Upload failed'));

    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));

    const toolSelect = screen.getAllByDisplayValue('Select a tool...')[0];
    fireEvent.change(toolSelect, { target: { value: 'WorldCheck' } });
    const summaryTextarea = screen.getByPlaceholderText(/Summarize the screening/);
    fireEvent.change(summaryTextarea, { target: { value: 'Summary' } });

    const submitButtons = screen.getAllByText('Upload Screening');
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Upload failed:', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('shows loading spinner when upload is pending', () => {
    (useCreateSanctionsScreening as vi.Mock).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('Upload Screening'));

    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  // ── Details Modal ──

  it('opens details modal and shows screening details', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    expect(screen.getByRole('heading', { name: 'Sanctions Screening Details' })).toBeInTheDocument();
    const pendingReviewElements = screen.getAllByText('Pending Review');
    expect(pendingReviewElements.length).toBeGreaterThanOrEqual(2); // card + modal
    expect(screen.getAllByText('WorldCheck').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('REF-123')).toBeInTheDocument();
    expect(screen.getAllByText('Test screening summary').length).toBe(2); // card + modal
  });

  it('displays metadata in details modal', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    expect(screen.getByText('Additional Metadata')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // entities_screened
    expect(screen.getByText('85%')).toBeInTheDocument(); // confidence_score
    expect(screen.getByText('HIGH')).toBeInTheDocument(); // risk_level
    expect(screen.getByText('OFAC')).toBeInTheDocument();
    expect(screen.getByText('EU')).toBeInTheDocument();
  });

  it('triggers download in details modal', async () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    fireEvent.click(screen.getByText('Download Report'));

    await waitFor(() => {
      expect(mockDownloadMutation.mutateAsync).toHaveBeenCalledWith('SCREENING-1');
    });
  });

  it('triggers delete with confirmation in details modal', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteMutation.mutateAsync).toHaveBeenCalledWith('SCREENING-1');
    });
    (window.confirm as vi.Mock).mockRestore();
  });

  it('does not delete when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    expect(mockDeleteMutation.mutateAsync).not.toHaveBeenCalled();
    (window.confirm as vi.Mock).mockRestore();
  });

  it('hides download button when no evidence_id', () => {
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({
      data: {
        screenings: [{ ...mockScreenings[0], evidence_id: undefined }],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
      isLoading: false,
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    expect(screen.queryByText('Download Report')).not.toBeInTheDocument();
  });

  it('shows file details in details modal', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    expect(screen.getByText('Report File')).toBeInTheDocument();
  });

  it('does not show metadata section when metadata is empty', () => {
    (useCaseSanctionsScreenings as vi.Mock).mockReturnValue({
      data: {
        screenings: [{ ...mockScreenings[0], metadata: undefined }],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
      isLoading: false,
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    expect(screen.queryByText('Additional Metadata')).not.toBeInTheDocument();
  });

  it('closes details modal via X button', () => {
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));
    expect(screen.getByRole('heading', { name: 'Sanctions Screening Details' })).toBeInTheDocument();

    // Click the X close button (the second one if there are multiple)
    const closeButtons = document.querySelectorAll('button');
    const xButton = Array.from(closeButtons).find(
      (btn) => btn.querySelector('svg') && btn.classList.contains('rounded-md'),
    );
    if (xButton) fireEvent.click(xButton);
  });

  it('shows Deleting... text when delete is pending', () => {
    (useDeleteSanctionsScreening as vi.Mock).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    expect(screen.getByText('Deleting...')).toBeInTheDocument();
  });

  it('shows Downloading... text when download is pending', () => {
    (useDownloadSanctionsReport as vi.Mock).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    fireEvent.click(screen.getByText('View Details →'));

    expect(screen.getByText('Downloading...')).toBeInTheDocument();
  });

  it('does not show statistics when data is unavailable', () => {
    (useCaseSanctionsStatistics as vi.Mock).mockReturnValue({ data: null });
    render(<SanctionsScreeningTab caseId="CASE-123" />);
    expect(screen.queryByText(/Total:/)).not.toBeInTheDocument();
  });
});
