import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AlertsDetailModal from '../AlertsDetailModal';
import triageService from '../../services/triageservice';
import { useSystemConfig } from '@/shared/hooks/useSystemConfig';
import { useCase, canActOnCase } from '../../../cases/hooks/useCase';

vi.mock('../../services/triageservice');
vi.mock('@/shared/hooks/useSystemConfig');
vi.mock('../../../cases/hooks/useCase');

describe('AlertsDetailModal', () => {
  const mockAlert = {
    alert_id: 'alert-123',
    tenant_id: 'tenant-1',
    priority: 'URGENT',
    alert_type: 'FRAUD',
    source: 'REST API',
    txtp: 'tx-456',
    message: 'Test alert message',
    alert_data: {},
    transaction: { id: 'tx-456', amount: 1000 },
    network_map: {},
    confidence_per: 85,
    created_at: '2024-01-01T00:00:00Z',
    case_id: null,
    prediction_outcome: null,
  };

  const mockActionHistory = [
    {
      audit_log_id: 'log-1',
      operation: 'ALERT_CREATED',
      action_performed: 'Alert created',
      performed_at: '2024-01-01T00:00:00Z',
      user_id: 'user-1',
      outcome: 'SUCCESS',
    },
  ];

  const mockOnClose = vi.fn();
  const mockOnAlertUpdated = vi.fn();
  const mockOnManualTriage = vi.fn();
  const mockOnCloseAlert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSystemConfig as vi.Mock).mockReturnValue({
      isManualMode: true,
      isDisabledMode: false,
      isAIMode: false,
    });
    (useCase as vi.Mock).mockReturnValue({
      data: null,
      loading: false,
    });
    (canActOnCase as vi.Mock).mockReturnValue(true);
  });

  it('does not render when isOpen is false', () => {
    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={false}
        onClose={mockOnClose}
      />,
    );
    expect(screen.queryByText(/Alert Details/i)).not.toBeInTheDocument();
  });

  it('renders loading state when fetching alert', () => {
    (triageService.getAlertById as vi.Mock).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByText(/Loading alert details/i)).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    const error = new Error('Failed to load alert');
    (triageService.getAlertById as vi.Mock).mockRejectedValue(error);

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Alert/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Failed to load alert/i)).toBeInTheDocument();
  });

  it('renders alert details when loaded successfully', async () => {
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue(
      mockActionHistory,
    );

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    expect(screen.getByText('alert-123')).toBeInTheDocument();
    expect(screen.getByText('Test alert message')).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('closes modal when backdrop is clicked', async () => {
    const user = userEvent.setup();
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    const { container } = render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
        onAlertUpdated={mockOnAlertUpdated}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    const backdrop = container.querySelector('.fixed.inset-0.bg-gray-900');
    if (backdrop) {
      await user.click(backdrop as HTMLElement);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnAlertUpdated).toHaveBeenCalledTimes(1);
    }
  });

  it('shows manual triage button in manual mode', async () => {
    (useSystemConfig as vi.Mock).mockReturnValue({
      isManualMode: true,
      isDisabledMode: false,
      isAIMode: false,
    });
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
        onManualTriage={mockOnManualTriage}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    const updateButton = screen.getByRole('button', { name: /Update Alert/i });
    expect(updateButton).toBeInTheDocument();
  });

  it('calls onManualTriage when update button is clicked', async () => {
    const user = userEvent.setup();
    (useSystemConfig as vi.Mock).mockReturnValue({
      isManualMode: true,
      isDisabledMode: false,
      isAIMode: false,
    });
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
        onManualTriage={mockOnManualTriage}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    const updateButton = screen.getByRole('button', { name: /Update Alert/i });
    await user.click(updateButton);

    expect(mockOnManualTriage).toHaveBeenCalledWith(
      expect.objectContaining({
        alert_id: 'alert-123',
      }),
    );
  });

  it('shows AI Processed badge in AI mode', async () => {
    (useSystemConfig as vi.Mock).mockReturnValue({
      isManualMode: false,
      isDisabledMode: false,
      isAIMode: true,
    });
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('AI Processed')).toBeInTheDocument();
    });
  });

  it('displays action history', async () => {
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue(
      mockActionHistory,
    );

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Action History')).toBeInTheDocument();
    });

    // Action history displays action_performed, not operation
    expect(screen.getByText('Alert created')).toBeInTheDocument();
  });

  it('displays transaction data when available', async () => {
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Transaction Data')).toBeInTheDocument();
    });

    // Transaction data should be displayed
    expect(screen.getByText(/tx-456/i)).toBeInTheDocument();
  });

  it('displays case status when case is linked', async () => {
    const alertWithCase = { ...mockAlert, case_id: 'case-123' };
    (triageService.getAlertById as vi.Mock).mockResolvedValue(alertWithCase);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);
    (useCase as vi.Mock).mockReturnValue({
      data: { status: 'IN_PROGRESS' },
      loading: false,
    });

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Summary')).toBeInTheDocument();
    });

    // Case status is displayed in the Alert Summary section
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
  });

  it('fetches alert details when alertId changes', async () => {
    const { rerender } = render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    await waitFor(() => {
      expect(triageService.getAlertById).toHaveBeenCalledWith('alert-123');
    });

    // Change alertId
    rerender(
      <AlertsDetailModal
        alertId="alert-456"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(triageService.getAlertById).toHaveBeenCalledWith('alert-456');
    });
  });

  it('handles retry button click in error state', async () => {
    const user = userEvent.setup();
    const error = new Error('Failed to load alert');
    (triageService.getAlertById as vi.Mock).mockRejectedValue(error);

    // Mock window.location.reload
    const originalReload = window.location.reload;
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });

    render(
      <AlertsDetailModal
        alertId="alert-123"
        isOpen={true}
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Error Loading Alert/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    expect(reloadSpy).toHaveBeenCalled();

    // Restore original
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: originalReload },
      writable: true,
    });
  });
});
