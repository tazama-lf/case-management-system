import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateInvestigationReportModal from '../GenerateInvestigationReportModal';
import { useNotifications } from '@/shared/providers/NotificationProvider';

vi.mock('@/shared/providers/NotificationProvider');
vi.mock('../../../services/userService', () => ({
  default: {
    getAllUsers: vi.fn(),
  },
}));
vi.mock('../../../services/taskService', () => ({
  taskService: {
    getTasksByCaseId: vi.fn(),
  },
}));
vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    vfs: {},
    createPdf: vi.fn(() => ({
      download: vi.fn(),
      open: vi.fn(),
    })),
  },
}));

describe('GenerateInvestigationReportModal', () => {
  const mockOnClose = vi.fn();
  const mockShowNotification = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    (useNotifications as vi.Mock).mockReturnValue({
      showNotification: mockShowNotification,
    });
    const userServiceModule = await import('../../../services/userService');
    const taskServiceModule = await import('../../../services/taskService');
    (userServiceModule.default.getAllUsers as vi.Mock).mockResolvedValue([]);
    (taskServiceModule.taskService.getTasksByCaseId as vi.Mock).mockResolvedValue([]);
  });

  it('does not render when open is false', () => {
    render(
      <GenerateInvestigationReportModal
        open={false}
        onClose={mockOnClose}
        caseId="CASE-123"
      />,
    );
    expect(screen.queryByText(/Generate Case Investigation Report/i)).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId="CASE-123"
      />,
    );

    expect(screen.getByRole('heading', { name: /Generate Case Investigation Report/i })).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GenerateInvestigationReportModal
        open={true}
        onClose={mockOnClose}
        caseId="CASE-123"
      />,
    );

    const closeButton = screen.getByRole('button', { name: /Close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

