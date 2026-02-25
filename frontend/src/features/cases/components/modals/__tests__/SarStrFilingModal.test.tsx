import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SarStrFilingModal from '../SarStrFilingModal';
import { evidenceService } from '../../../services/evidenceService';

vi.mock('../../../services/evidenceService', () => ({
  evidenceService: {
    getTaskEvidence: vi.fn(),
    uploadEvidence: vi.fn(),
    downloadEvidence: vi.fn(),
  },
}));

describe('SarStrFilingModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: [],
    });
  });

  it('does not render when open is false', () => {
    render(
      <SarStrFilingModal
        open={false}
        onClose={mockOnClose}
        taskId="TASK-123"
        caseId="CASE-123"
      />,
    );
    expect(
      screen.queryByRole('heading', { name: /SAR\/STR Filing/i }),
    ).not.toBeInTheDocument();
  });

  it('renders modal when open', async () => {
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId="TASK-123"
        caseId="CASE-123"
      />,
    );

    await waitFor(() => {
      const headings = screen.getAllByRole('heading', {
        name: /SAR\/STR Filing/i,
      });
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  it('loads existing evidence when modal opens', async () => {
    const mockEvidence = [
      {
        id: 'ev-1',
        evidenceType: 'SAR_STR_FILING',
        description: 'SAR Filing',
      },
    ];
    (evidenceService.getTaskEvidence as vi.Mock).mockResolvedValue({
      evidence: mockEvidence,
    });

    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId="TASK-123"
        caseId="CASE-123"
      />,
    );

    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith('TASK-123');
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId="TASK-123"
        caseId="CASE-123"
      />,
    );

    await waitFor(() => {
      const closeButtons = screen.getAllByRole('button', { name: /Close/i });
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    const closeButtons = screen.getAllByRole('button', { name: /Close/i });
    await user.click(closeButtons[0]);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
