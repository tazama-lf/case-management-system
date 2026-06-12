import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AlertsDetailModal from '../AlertsDetailModal';
import triageService from '../../services/triageservice';
import { useSystemConfig } from '@/shared/hooks/useSystemConfig';
import { useCase, canActOnCase } from '../../../cases/hooks/useCase';
import { caseService } from '../../../cases/services/caseService';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/triageservice');
vi.mock('@/shared/hooks/useSystemConfig');
vi.mock('../../../cases/hooks/useCase');
vi.mock('../../../cases/services/caseService', () => ({
  caseService: {
    checkCaseAccess: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderModal = (ui: React.ReactElement) =>
  render(ui, { wrapper: createWrapper() });

describe('AlertsDetailModal', () => {
  const mockAlert = {
    alert_id: 123,
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
    (caseService.checkCaseAccess as vi.Mock).mockResolvedValue(true);
  });

  it('does not render when isOpen is false', () => {
    renderModal(
      <AlertsDetailModal alertId={123} isOpen={false} onClose={mockOnClose} />,
    );
    expect(screen.queryByText(/Alert Details/i)).not.toBeInTheDocument();
  });

  it('renders loading state when fetching alert', () => {
    (triageService.getAlertById as vi.Mock).mockImplementation(
      () => new Promise(() => { }), // Never resolves
    );

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    expect(screen.getByText(/Loading alert details/i)).toBeInTheDocument();
  });

  it('renders error state when fetch fails', async () => {
    const error = new Error('Failed to load alert');
    (triageService.getAlertById as vi.Mock).mockRejectedValue(error);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
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

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('No message available')).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
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

    const { container } = renderModal(
      <AlertsDetailModal
        alertId={123}
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

    renderModal(
      <AlertsDetailModal
        alertId={123}
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

    renderModal(
      <AlertsDetailModal
        alertId={123}
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
        alert_id: 123,
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

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
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

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
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

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
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
      data: { case_id: 456, status: 'IN_PROGRESS' },
      loading: false,
    });
    (caseService.checkCaseAccess as vi.Mock).mockResolvedValue(true);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Summary')).toBeInTheDocument();
    });

    // Case status is displayed in the Alert Summary section
    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();

    // Case ID is displayed (from alert.case_id)
    expect(screen.getByText('case-123')).toBeInTheDocument();
  });

  it('navigates to case details when case ID is clicked', async () => {
    const user = userEvent.setup();
    const alertWithCase = { ...mockAlert, case_id: 'case-123' };
    (triageService.getAlertById as vi.Mock).mockResolvedValue(alertWithCase);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);
    (useCase as vi.Mock).mockReturnValue({
      data: { case_id: 456, status: 'IN_PROGRESS' },
      loading: false,
    });
    (caseService.checkCaseAccess as vi.Mock).mockResolvedValue(true);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Summary')).toBeInTheDocument();
    });

    // Click on the case ID link
    const caseIdButton = screen.getByRole('button', { name: /case-123/i });
    await user.click(caseIdButton);

    // Verify navigation was called with correct case ID
    expect(mockNavigate).toHaveBeenCalledWith('/cases/case-123');
  });

  it('fetches alert details when alertId changes', async () => {
    const { rerender } = renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    await waitFor(() => {
      expect(triageService.getAlertById).toHaveBeenCalledWith(123);
    });

    // Change alertId
    rerender(
      <AlertsDetailModal alertId={456} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(triageService.getAlertById).toHaveBeenCalledWith(456);
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

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
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

  it('shows no transaction data message when transaction is null', async () => {
    const alertNoTx = { ...mockAlert, transaction: null };
    (triageService.getAlertById as vi.Mock).mockResolvedValue(alertNoTx);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Transaction Data')).toBeInTheDocument();
    });
    expect(screen.getByText('No transaction data')).toBeInTheDocument();
  });

  it('shows no action history message when empty', async () => {
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue(null);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No action history available'),
      ).toBeInTheDocument();
    });
  });

  it('shows empty typologies state when none are triggered', async () => {
    (triageService.getAlertById as vi.Mock).mockResolvedValue(mockAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Triggered Typologies')).toBeInTheDocument();
      expect(screen.getByText('No typologies triggered')).toBeInTheDocument();
    });
  });

  it('renders CRITICAL priority badge', async () => {
    const criticalAlert = { ...mockAlert, priority: 'CRITICAL' };
    (triageService.getAlertById as vi.Mock).mockResolvedValue(criticalAlert);
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });
  });

  it('renders alert with alert_data containing typology results', async () => {
    const user = userEvent.setup();
    const alertWithTypology = {
      ...mockAlert,
      alert_data: {
        tadpResult: {
          typologyResult: [
            {
              cfg: 'TYP-001',
              label: 'Money Laundering',
              result: 95,
              ruleResults: [
                {
                  id: 'R001',
                  label: 'High Value',
                  subRuleRef: 'Velocity',
                  wght: 50,
                },
              ],
            },
          ],
        },
      },
    };
    (triageService.getAlertById as vi.Mock).mockResolvedValue(
      alertWithTypology,
    );
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Money Laundering')).toBeInTheDocument();
    });

    if (!screen.queryByText('R001')) {
      await user.click(
        screen.getByRole('button', { name: /money laundering/i }),
      );
    }

    await waitFor(() => {
      expect(screen.getByText('R001')).toBeInTheDocument();
      expect(screen.getByText('Sub-ref: Velocity')).toBeInTheDocument();
    });
  });

  it('displays all typologies that exceed alert threshold', async () => {
    const alertWithMultipleTypologies = {
      ...mockAlert,
      alerted_typologies: [
        {
          id: 'TYP-001',
          label: 'Money Laundering',
          result: 95,
          alertThreshold: 50,
        },
        {
          id: 'TYP-002',
          label: 'Structuring',
          result: 75,
          alertThreshold: 60,
        },
      ],
      alert_data: {
        tadpResult: {
          typologyResult: [
            {
              cfg: 'TYP-001',
              label: 'Money Laundering',
              result: 95,
              workflow: {
                alertThreshold: 50,
                interdictionThreshold: 80,
              },
              ruleResults: [],
            },
            {
              cfg: 'TYP-002',
              label: 'Structuring',
              result: 75,
              workflow: {
                alertThreshold: 60,
                interdictionThreshold: 80,
              },
              ruleResults: [],
            },
            {
              cfg: 'TYP-003',
              label: 'Smurfing',
              result: 45,
              workflow: {
                alertThreshold: 60,
                interdictionThreshold: 80,
              },
              ruleResults: [],
            },
          ],
        },
      },
    };
    (triageService.getAlertById as vi.Mock).mockResolvedValue(
      alertWithMultipleTypologies,
    );
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);

    renderModal(
      <AlertsDetailModal alertId={123} isOpen={true} onClose={mockOnClose} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Triggered Typologies')).toBeInTheDocument();
      expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      expect(screen.getByText('Structuring')).toBeInTheDocument();
      expect(screen.queryByText('Smurfing')).not.toBeInTheDocument();
    });
  });

  it('hides update button when canActOnCase is false', async () => {
    (canActOnCase as vi.Mock).mockReturnValue(false);
    (triageService.getAlertById as vi.Mock).mockResolvedValue({
      ...mockAlert,
      case_id: 'case-1',
    });
    (triageService.getAlertActionHistory as vi.Mock).mockResolvedValue([]);
    (useCase as vi.Mock).mockReturnValue({ data: { status: 'CLOSED' } });

    renderModal(
      <AlertsDetailModal
        alertId={123}
        isOpen={true}
        onClose={mockOnClose}
        onManualTriage={mockOnManualTriage}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /Update Alert/i }),
    ).not.toBeInTheDocument();
  });
});
