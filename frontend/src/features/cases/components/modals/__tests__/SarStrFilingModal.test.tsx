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

vi.mock('../../../../../shared/providers/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User' },
    hasComplianceOfficerRole: () => false,
    hasSupervisorRole: () => false,
  }),
}));

vi.mock('../../../services/taskService', () => ({
  taskService: {
    completeTask: vi.fn(),
    updateTaskStatus: vi.fn(),
  },
  TaskStatus: {},
}));

describe('SarStrFilingModal', () => {
  const mockOnClose = vi.fn();
  const mockTask = {
    id: 'TASK-123',
    name: 'SAR/STR Filing',
    status: 'STATUS_20_IN_PROGRESS',
    caseId: 'CASE-123',
    assignee: 'user-1',
    created: '2024-01-01T00:00:00Z',
    dueDate: null,
    description: 'File SAR/STR',
  } as any;

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
        taskId={123}
        caseId={123}
        task={mockTask}
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
        taskId={123}
        caseId={123}
        task={mockTask}
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
        taskId={123}
        caseId={123}
        task={mockTask}
      />,
    );

    await waitFor(() => {
      expect(evidenceService.getTaskEvidence).toHaveBeenCalledWith(123);
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SarStrFilingModal
        open={true}
        onClose={mockOnClose}
        taskId={123}
        caseId={123}
        task={mockTask}
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
