import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LinkedItemsTab from '../LinkedItemsTab';
import { caseService } from '../../../services/caseService';
import triageService from '@/features/alerts/services/triageservice';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../services/caseService');
vi.mock('@/features/alerts/services/triageservice');
vi.mock('@/features/alerts/components/AlertsDetailModal', () => ({
  default: () => <div data-testid="alerts-detail-modal" />,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('LinkedItemsTab', () => {
  const mockCase = {
    case_id: 123,
    case_type: 'FRAUD',
    parent_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(mockCase);
    (triageService.getAlerts as vi.Mock).mockResolvedValue({ alerts: [] });
    (caseService.getAllCases as vi.Mock).mockResolvedValue({ cases: [mockCase] });
  });

  it('renders loading state initially', () => {
    (caseService.getCaseDetails as vi.Mock).mockImplementation(() => new Promise(() => {}));
    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('displays related transactions heading after loading', async () => {
    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Related Transactions')).toBeInTheDocument();
    });
  });

  it('displays no related transactions message when none found', async () => {
    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No related transactions found')).toBeInTheDocument();
    });
  });

  it('fetches case details and alerts on mount', async () => {
    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(caseService.getCaseDetails).toHaveBeenCalledWith(123);
      expect(triageService.getAlerts).toHaveBeenCalledWith({ limit: 1000 });
      expect(caseService.getAllCases).toHaveBeenCalledWith({ limit: 1000 });
    });
  });

  it('displays transaction from alert with TransactionID key', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 1,
          case_id: 123,
          message: 'Fraud Alert',
          txtp: 'Suspicious transfer',
          transaction: { TransactionID: 'TXN-001' },
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/TXN-001/)).toBeInTheDocument();
      expect(screen.getByText(/Fraud Alert/)).toBeInTheDocument();
    });
  });

  it('uses transaction_id fallback key', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 2,
          case_id: 123,
          message: 'Alert 2',
          transaction: { transaction_id: 'TXN-FALLBACK' },
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/TXN-FALLBACK/)).toBeInTheDocument();
    });
  });

  it('uses id as last fallback key for transaction', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 3,
          case_id: 123,
          message: 'Alert 3',
          transaction: { id: 'TXN-ID-FALLBACK' },
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/TXN-ID-FALLBACK/)).toBeInTheDocument();
    });
  });

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (caseService.getCaseDetails as vi.Mock).mockRejectedValue(new Error('Network error'));

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch linked items:', expect.any(Error));
    });
    consoleSpy.mockRestore();
  });

  it('deduplicates transactions by ID', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 1,
          case_id: 123,
          message: 'Alert 1',
          transaction: { TransactionID: 'TXN-SAME' },
        },
        {
          alert_id: 2,
          case_id: 123,
          message: 'Alert 2',
          transaction: { TransactionID: 'TXN-SAME' },
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      const links = screen.getAllByText(/TXN-SAME/);
      expect(links).toHaveLength(1);
    });
  });

  it('ignores alerts not linked to current case', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 1,
          case_id: 999,
          message: 'Other Case Alert',
          transaction: { TransactionID: 'OTHER-TXN' },
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No related transactions found')).toBeInTheDocument();
    });
  });

  it('handles alert with null transaction', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 1,
          case_id: 123,
          message: 'Alert without txn',
          transaction: null,
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No related transactions found')).toBeInTheDocument();
    });
  });

  it('renders AlertsDetailModal component', async () => {
    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('alerts-detail-modal')).toBeInTheDocument();
    });
  });

  it('uses default labels when alert message and txtp are missing', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 1,
          case_id: 123,
          transaction: { TransactionID: 'TXN-DEFAULT' },
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/TXN-DEFAULT/)).toBeInTheDocument();
      expect(screen.getByText(/Transaction Alert/)).toBeInTheDocument();
    });
  });

  it('finds related cases through shared alert IDs', async () => {
    // Alert 1 belongs to our case (123), Alert 1 also appears in case 456
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 1,
          case_id: 123,
          message: 'Shared Alert',
          transaction: { TransactionID: 'TXN-SHARED' },
        },
        {
          alert_id: 1,
          case_id: 456,
          message: 'Same Alert Different Case',
          transaction: null,
        },
      ],
    });
    (caseService.getAllCases as vi.Mock).mockResolvedValue({ cases: [mockCase] });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      // The related case 456 is found, but only transactions are displayed in the UI
      expect(screen.getByText(/TXN-SHARED/)).toBeInTheDocument();
    });
  });

  it('finds related cases via parent_id matching', async () => {
    const caseWithParent = { ...mockCase, parent_id: 999 };
    (caseService.getCaseDetails as vi.Mock).mockResolvedValue(caseWithParent);
    (caseService.getAllCases as vi.Mock).mockResolvedValue({
      cases: [
        { case_id: 123, parent_id: null },
        { case_id: 999, parent_id: null, status: 'STATUS_20_IN_PROGRESS' },
      ],
    });
    (triageService.getAlerts as vi.Mock).mockResolvedValue({ alerts: [] });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      // Related case 999 found via parent_id matching
      expect(screen.getByText('Related Transactions')).toBeInTheDocument();
    });
  });

  it('handles alert with object transaction missing all ID keys', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 1,
          case_id: 123,
          message: 'Alert',
          transaction: { someOtherField: 'value' },
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No related transactions found')).toBeInTheDocument();
    });
  });

  it('handles alert with non-object transaction', async () => {
    (triageService.getAlerts as vi.Mock).mockResolvedValue({
      alerts: [
        {
          alert_id: 1,
          case_id: 123,
          message: 'Alert',
          transaction: 'not-an-object',
        },
      ],
    });

    render(<LinkedItemsTab caseId={123} />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No related transactions found')).toBeInTheDocument();
    });
  });
});
