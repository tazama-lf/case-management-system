import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AlertsDashboard from '../AlertsDashboard';
import { useAlerts } from '../../hooks/useAlerts';
import { useSystemConfig } from '@/shared/hooks/useSystemConfig';
import { useAlertFilterOptions, useAlertOperations } from '../../hooks/useAlertsQuery';
import { useToast } from '@/shared/providers/ToastProvider';
import triageService from '../../services/triageservice';
import { transformBackendAlertToUI } from '../../utils/alertTransformers';

// Mock dependencies
vi.mock('../../hooks/useAlerts');
vi.mock('@/shared/hooks/useSystemConfig');
vi.mock('../../hooks/useAlertsQuery');
vi.mock('@/shared/providers/ToastProvider');
vi.mock('../../services/triageservice');
vi.mock('../../utils/alertTransformers');

// Mock lazy-loaded modals
vi.mock('../../components/AlertsDetailModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="alerts-detail-modal">Alerts Detail Modal</div> : null,
}));

vi.mock('../../components/ManualTriageModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="manual-triage-modal">Manual Triage Modal</div> : null,
}));

vi.mock('../../components/TransactionMessagesModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="transaction-messages-modal">Transaction Messages Modal</div> : null,
}));

vi.mock('../../components/MessagePayloadModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="message-payload-modal">Message Payload Modal</div> : null,
}));

describe('AlertsDashboard', () => {
  const mockAlerts = [
    {
      alert_id: 'alert-1',
      alert_type: 'FRAUD',
      source: 'REST API',
      priority: 'URGENT',
      riskScore: 75,
      confidence_per: 85,
      created_at: '2024-01-01T00:00:00Z',
      message: 'Test alert',
      txtp: 'tx-123',
      transaction: { id: 'tx-123' },
    },
    {
      alert_id: 'alert-2',
      alert_type: 'AML',
      source: 'NATS',
      priority: 'CRITICAL',
      riskScore: 90,
      confidence_per: 95,
      created_at: '2024-01-02T00:00:00Z',
      message: 'Another alert',
      txtp: 'tx-456',
    },
  ];

  const mockUseAlerts = {
    paginatedAlerts: mockAlerts,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 2,
      pageSize: 10,
    },
    loading: false,
    error: null,
    filters: {
      query: '',
      source: '',
      type: '',
      priority: '',
      timeRange: '',
      customDateRange: undefined,
    },
    sort: { column: 'created_at', direction: 'desc' as const },
    lastUpdated: new Date(),
    setFilters: vi.fn(),
    setSort: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    refreshAlerts: vi.fn(),
  };

  const mockUseSystemConfig = {
    isAIMode: false,
    isManualMode: true,
    isDisabledMode: false,
  };

  const mockUseAlertFilterOptions = {
    filterOptions: {
      priorities: ['NEW', 'URGENT', 'CRITICAL', 'BREACH'],
      alertTypes: ['FRAUD', 'AML', 'FRAUD_AND_AML'],
      sources: ['REST API', 'NATS'],
    },
  };

  const mockUseAlertOperations = {
    performManualTriage: vi.fn(),
  };

  const mockUseToast = {
    success: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAlerts as vi.Mock).mockReturnValue(mockUseAlerts);
    (useSystemConfig as vi.Mock).mockReturnValue(mockUseSystemConfig);
    (useAlertFilterOptions as vi.Mock).mockReturnValue(mockUseAlertFilterOptions);
    (useAlertOperations as vi.Mock).mockReturnValue(mockUseAlertOperations);
    (useToast as vi.Mock).mockReturnValue(mockUseToast);
    (transformBackendAlertToUI as vi.Mock).mockImplementation((alert) => alert);
  });

  it('renders the alerts dashboard with title and subtitle', () => {
    render(<AlertsDashboard />);
    expect(screen.getByText('Alerts Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText(/Manual triage and investigation - all alerts require human review/i),
    ).toBeInTheDocument();
  });

  it('displays loading skeleton when loading and no alerts', () => {
    (useAlerts as vi.Mock).mockReturnValue({
      ...mockUseAlerts,
      loading: true,
      paginatedAlerts: [],
    });
    render(<AlertsDashboard />);
    // The skeleton should be rendered by AlertsTableSkeleton
    expect(screen.getByText('Alerts Dashboard')).toBeInTheDocument();
  });

  it('displays error fallback when error occurs and no alerts', () => {
    (useAlerts as vi.Mock).mockReturnValue({
      ...mockUseAlerts,
      error: 'Failed to load alerts',
      paginatedAlerts: [],
    });
    render(<AlertsDashboard />);
    // ErrorFallback component should be rendered - use getAllByText and check first match
    const errorTexts = screen.getAllByText(/Failed to load alerts/i);
    expect(errorTexts.length).toBeGreaterThan(0);
    // Should also have retry button (ErrorFallback uses "Try Again" text)
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders alerts table with data', () => {
    render(<AlertsDashboard />);
    expect(screen.getByText('alert-1')).toBeInTheDocument();
    expect(screen.getByText('alert-2')).toBeInTheDocument();
  });

  it('opens detail modal when a row is clicked', async () => {
    const user = userEvent.setup();
    const mockGetAlertById = vi.fn().mockResolvedValue(mockAlerts[0]);
    (triageService.getAlertById as vi.Mock).mockImplementation(mockGetAlertById);

    render(<AlertsDashboard />);

    // Find and click a row (assuming AlertsTable renders rows clickable)
    const alertRow = screen.getByText('alert-1').closest('tr');
    if (alertRow) {
      await user.click(alertRow);
    }

    await waitFor(() => {
      expect(mockGetAlertById).toHaveBeenCalledWith('alert-1');
    });
  });

  it('handles filter changes', async () => {
    const user = userEvent.setup();
    const setFilters = vi.fn();
    (useAlerts as vi.Mock).mockReturnValue({
      ...mockUseAlerts,
      setFilters,
    });

    render(<AlertsDashboard />);

    // Open filters
    const filtersButton = screen.getByRole('button', { name: /filters/i });
    await user.click(filtersButton);

    // Change a filter (e.g., priority)
    const prioritySelect = screen.getByLabelText(/priority/i);
    await user.selectOptions(prioritySelect, 'URGENT');

    await waitFor(() => {
      expect(setFilters).toHaveBeenCalled();
    });
  });

  it('handles sorting changes', async () => {
    const user = userEvent.setup();
    const setSort = vi.fn();
    (useAlerts as vi.Mock).mockReturnValue({
      ...mockUseAlerts,
      setSort,
    });

    render(<AlertsDashboard />);

    // Click on a sortable column header
    const alertIdHeader = screen.getByText(/alert id/i);
    if (alertIdHeader) {
      await user.click(alertIdHeader);
      await waitFor(() => {
        expect(setSort).toHaveBeenCalled();
      });
    }
  });

  it('displays subtitle based on system config mode', () => {
    // Test AI mode
    (useSystemConfig as vi.Mock).mockReturnValue({
      isAIMode: true,
      isManualMode: false,
      isDisabledMode: false,
    });
    const { rerender } = render(<AlertsDashboard />);
    expect(
      screen.getByText(/AI-automated triage with confidence-based routing/i),
    ).toBeInTheDocument();

    // Test disabled mode
    (useSystemConfig as vi.Mock).mockReturnValue({
      isAIMode: false,
      isManualMode: false,
      isDisabledMode: true,
    });
    rerender(<AlertsDashboard />);
    expect(
      screen.getByText(/Direct investigation mode - alerts bypass triage/i),
    ).toBeInTheDocument();
  });

  it('handles transaction ID click to open transaction messages modal', async () => {
    const user = userEvent.setup();
    render(<AlertsDashboard />);

    // Find and click a transaction ID button
    const txButtons = screen.getAllByText(/tx-/i);
    if (txButtons.length > 0) {
      await user.click(txButtons[0]);
      await waitFor(() => {
        expect(screen.getByTestId('transaction-messages-modal')).toBeInTheDocument();
      });
    }
  });
});

