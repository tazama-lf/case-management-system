import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfileOverviewTab from '../profileoverview/ProfileOverviewTab';

const mockGenerateProfile = vi.fn();

vi.mock('@/features/cases/services/profileService', () => ({
  profileService: {
    generateProfile: (...args: any[]) => mockGenerateProfile(...args),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

const makeProfileResponse = (overrides?: any) => ({
  transactionCreditorResp: {
    status: 'success',
    row_count: 2,
    data: [
      {
        entity_id: 'ENT-C1',
        creditor_name: 'Alice Corp',
        entity_role: 'Primary Creditor',
        entity_type: 'Corporate',
        event_date: '2024-03-01',
        tx_amount: '1000',
        tx_ccy: 'USD',
        tx_type: 'CREDIT',
      },
      {
        entity_id: 'ENT-C1',
        creditor_name: 'Alice Corp',
        entity_role: 'Creditor',
        entity_type: 'Corporate',
        event_date: '2024-03-02',
        tx_amount: '2000',
        tx_ccy: 'EUR',
        tx_type: 'DEBIT',
      },
    ],
  },
  transactionDebtorResp: {
    status: 'success',
    row_count: 1,
    data: [
      {
        entity_id: 'ENT-D1',
        debtor_name: 'Bob Ltd',
        entity_role: 'Debtor',
        entity_type: 'Individual',
        event_date: '2024-03-05',
        tx_amount: '500',
        tx_ccy: 'GBP',
        tx_type: 'TRANSFER',
      },
    ],
  },
  ...overrides,
});

describe('ProfileOverviewTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows unable to display message when alertId is not provided', () => {
    render(<ProfileOverviewTab />);
    expect(
      screen.getByText('Unable to display profile data'),
    ).toBeInTheDocument();
  });

  it('shows unable to display when alertId provided but no transactionId', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} />);
    // alertId without transactionId: first shows loading, then missing transactionId check
    await waitFor(() => {
      expect(
        screen.getByText('Unable to display profile data'),
      ).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', () => {
    mockGenerateProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    expect(document.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error on fetch failure', async () => {
    mockGenerateProfile.mockRejectedValue(new Error('Service error'));
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Service error')).toBeInTheDocument();
    });
  });

  it('shows error from response.data.message', async () => {
    mockGenerateProfile.mockRejectedValue({
      response: { data: { message: 'Unauthorized access' } },
    });
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Unauthorized access')).toBeInTheDocument();
    });
  });

  it('shows fallback error for non-Error rejections', async () => {
    mockGenerateProfile.mockRejectedValue('string-error');
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(
        screen.getByText('Something went wrong while fetching profile'),
      ).toBeInTheDocument();
    });
  });

  it('shows error when response has failed status', async () => {
    mockGenerateProfile.mockResolvedValue({
      transactionCreditorResp: { status: 'error', data: [] },
      transactionDebtorResp: { status: 'success', data: [] },
    });
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(
        screen.getByText('Failed to fetch valid profile data'),
      ).toBeInTheDocument();
    });
  });

  it('shows no profile data when response is null', async () => {
    mockGenerateProfile.mockResolvedValue(null);
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(
        screen.getByText('Failed to fetch valid profile data'),
      ).toBeInTheDocument();
    });
  });

  it('sets error when alertId missing (no fetch)', () => {
    render(<ProfileOverviewTab transactionId="tx-1" />);
    expect(
      screen.getByText('Unable to display profile data'),
    ).toBeInTheDocument();
  });

  it('renders creditor profile data by default', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Profile Overview')).toBeInTheDocument();
    });
    expect(screen.getByText('Creditor Profile')).toBeInTheDocument();
    expect(screen.getByText('Alice Corp')).toBeInTheDocument();
    expect(screen.getByText('ENT-C1')).toBeInTheDocument();
    expect(screen.getByText('Primary Creditor')).toBeInTheDocument();
    expect(screen.getByText('Corporate')).toBeInTheDocument();
    expect(screen.getByText('3,000')).toBeInTheDocument(); // totalAmount
    expect(screen.getByText('Entity Information')).toBeInTheDocument();
  });

  it('switches to debtor tab and shows debtor data', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Profile Overview')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Debtor' }));

    expect(screen.getByText('Debtor Profile')).toBeInTheDocument();
    expect(screen.getByText('Bob Ltd')).toBeInTheDocument();
    expect(screen.getByText('ENT-D1')).toBeInTheDocument();
    expect(screen.getByText('Individual')).toBeInTheDocument();
  });

  it('switches back to creditor tab', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Profile Overview')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Debtor' }));
    expect(screen.getByText('Debtor Profile')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Creditor' }));
    expect(screen.getByText('Creditor Profile')).toBeInTheDocument();
  });

  it('renders transaction table with sorted data', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });
    expect(screen.getByText('CREDIT')).toBeInTheDocument();
    expect(screen.getByText('DEBIT')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
  });

  it('sorts by event_date ascending then descending', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    const dateHeader = screen.getByText(/^Date/);
    fireEvent.click(dateHeader); // asc
    fireEvent.click(dateHeader); // desc
    // table still renders
    expect(screen.getByText('CREDIT')).toBeInTheDocument();
  });

  it('sorts by tx_amount', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    const amountHeader = screen.getByText(/Transaction Amount/);
    fireEvent.click(amountHeader); // asc
    fireEvent.click(amountHeader); // desc
    expect(screen.getByText('CREDIT')).toBeInTheDocument();
  });

  it('sorts by tx_type (string sort)', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    const typeHeader = screen.getByText(/Transaction Type/);
    fireEvent.click(typeHeader);
    expect(screen.getByText('CREDIT')).toBeInTheDocument();
  });

  it('sorts by tx_ccy (string sort)', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    const ccyHeader = screen.getByText(/Transaction Currency/);
    fireEvent.click(ccyHeader);
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('shows sort icons correctly', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    const dateHeader = screen.getByText(/^Date/);
    // Initially shows default icon
    expect(dateHeader.textContent).toContain('⬍');

    fireEvent.click(dateHeader); // asc
    expect(dateHeader.textContent).toContain('↑');

    fireEvent.click(dateHeader); // desc
    expect(dateHeader.textContent).toContain('↓');
  });

  it('renders volume trend chart with data', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(
        screen.getByText('Transaction Volume Trend (90 Days)'),
      ).toBeInTheDocument();
    });
  });

  it('renders daily transaction count chart', async () => {
    mockGenerateProfile.mockResolvedValue(makeProfileResponse());
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Daily Transaction Count')).toBeInTheDocument();
    });
  });

  it('shows no data messages when transaction lists are empty', async () => {
    mockGenerateProfile.mockResolvedValue({
      transactionCreditorResp: { status: 'success', row_count: 0, data: [] },
      transactionDebtorResp: { status: 'success', row_count: 0, data: [] },
    });
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('No transactions available')).toBeInTheDocument();
    });
    const noDataMessages = screen.getAllByText('No data available');
    expect(noDataMessages.length).toBeGreaterThanOrEqual(2);
  });

  it('handles N/A for missing entity fields', async () => {
    mockGenerateProfile.mockResolvedValue({
      transactionCreditorResp: {
        status: 'success',
        row_count: 1,
        data: [
          {
            event_date: '2024-01-01',
            tx_amount: '100',
            tx_ccy: 'USD',
            tx_type: 'CREDIT',
          },
        ],
      },
      transactionDebtorResp: { status: 'success', row_count: 0, data: [] },
    });
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Entity Information')).toBeInTheDocument();
    });
    // entity_id, entity_role, entity_type are undefined => N/A
    const naElements = screen.getAllByText('N/A');
    expect(naElements.length).toBeGreaterThanOrEqual(2);
  });

  it('handles transactions with missing event_date in chart data', async () => {
    mockGenerateProfile.mockResolvedValue({
      transactionCreditorResp: {
        status: 'success',
        row_count: 2,
        data: [
          { event_date: '', tx_amount: '100', tx_ccy: 'USD', tx_type: 'A' },
          {
            event_date: '2024-01-01',
            tx_amount: '200',
            tx_ccy: 'EUR',
            tx_type: 'B',
          },
        ],
      },
      transactionDebtorResp: { status: 'success', row_count: 0, data: [] },
    });
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });
  });
});
