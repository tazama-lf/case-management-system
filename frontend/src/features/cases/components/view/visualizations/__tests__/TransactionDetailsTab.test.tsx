import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionDetailsTab from '../transactiondetails/TransactionDetailsTab';

const mockGetTransactionDetails = vi.fn();

vi.mock('../transactiondetails/services/service', () => ({
  default: {
    getTransactionDetails: (...args: any[]) =>
      mockGetTransactionDetails(...args),
  },
}));

const makeTransactionData = (overrides?: any) => ({
  transactionOverview: {
    pacs8: {
      transactionId: 'MSG-008-001',
      transactionType: 'FIToFICstmrCdtTrf',
      timestamp: '2024-06-15T10:30:00Z',
    },
    pacs2: {
      transactionId: 'MSG-002-001',
      transactionType: 'FIToFIPmtStsRpt',
      timestamp: '2024-06-15T10:31:00Z',
    },
  },
  transactionFlow: {
    debtor: {
      name: 'John Doe',
      account: { iban: 'US12345678901234567890' },
      bank: 'First National Bank',
    },
    amount: { amount: 5000, currency: 'USD' },
    creditor: {
      name: 'Jane Smith Corp',
      account: { iban: 'GB98765432109876543210' },
      bankName: 'Royal Bank',
    },
  },
  debtorProfile: {
    name: 'John Doe',
    account: { iban: 'US12345678901234567890' },
    bank: 'First National Bank',
  },
  creditorProfile: {
    name: 'Jane Smith Corp',
    account: { iban: 'GB98765432109876543210' },
    bank: 'Royal Bank',
  },
  amountAndCurrency: [
    {
      originalAmount: 5000,
      exchangeRate: 1.2,
      convertedAmount: 6000,
    },
  ],
  settlementDetails: {
    settlementDate: '2024-06-16',
    reference: 'REF-001',
    purpose: 'Invoice Payment',
  },
  ...overrides,
});

describe('TransactionDetailsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows no-transaction message when transactionId is not provided', () => {
    render(<TransactionDetailsTab tenantId="DEFAULT" />);
    expect(
      screen.getByText('Select a transaction to view details'),
    ).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    mockGetTransactionDetails.mockReturnValue(new Promise(() => {}));
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state on failure with Error instance', async () => {
    mockGetTransactionDetails.mockRejectedValue(
      new Error('Service unavailable'),
    );
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(
        screen.getByText(/Transaction Data Unavailable/),
      ).toBeInTheDocument();
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
      expect(screen.getByText(/TXN-001/)).toBeInTheDocument();
    });
  });

  it('shows fallback error message for non-Error rejection', async () => {
    mockGetTransactionDetails.mockRejectedValue('string-error');
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(
        screen.getByText('Failed to load transaction details'),
      ).toBeInTheDocument();
    });
  });

  it('shows no data when response is null', async () => {
    mockGetTransactionDetails.mockResolvedValue(null);
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  it('renders full transaction detail view with data', async () => {
    mockGetTransactionDetails.mockResolvedValue(makeTransactionData());
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Transaction Detail View')).toBeInTheDocument();
    });
    expect(screen.getByText('Transaction Overview')).toBeInTheDocument();
    expect(
      screen.getByText('PACS.008 - Payment Instruction'),
    ).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(
      screen.getByText('PACS.002 - Payment Status Report'),
    ).toBeInTheDocument();
    expect(screen.getByText('Acknowledgment')).toBeInTheDocument();
    expect(screen.getByText('MSG-008-001')).toBeInTheDocument();
    expect(screen.getByText('MSG-002-001')).toBeInTheDocument();
    expect(screen.getByText('FIToFICstmrCdtTrf')).toBeInTheDocument();
    expect(screen.getByText('FIToFIPmtStsRpt')).toBeInTheDocument();
  });

  it('renders transaction flow with debtor/creditor details', async () => {
    mockGetTransactionDetails.mockResolvedValue(makeTransactionData());
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Transaction Flow')).toBeInTheDocument();
    });
    expect(screen.getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText('Jane Smith Corp').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$5,000')).toBeInTheDocument();
    expect(
      screen.getAllByText('First National Bank').length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Royal Bank').length).toBeGreaterThanOrEqual(1);
  });

  it('renders debtor and creditor profiles', async () => {
    mockGetTransactionDetails.mockResolvedValue(makeTransactionData());
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Debtor Profile')).toBeInTheDocument();
    });
    expect(screen.getByText('Creditor Profile')).toBeInTheDocument();
  });

  it('renders amount and currency section', async () => {
    mockGetTransactionDetails.mockResolvedValue(makeTransactionData());
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Amount & Currency')).toBeInTheDocument();
    });
    expect(screen.getByText(/USD \$5,000/)).toBeInTheDocument();
    expect(screen.getByText('1.2')).toBeInTheDocument();
    expect(screen.getByText('$6,000')).toBeInTheDocument();
  });

  it('renders settlement details section', async () => {
    mockGetTransactionDetails.mockResolvedValue(makeTransactionData());
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Settlement Details')).toBeInTheDocument();
    });
    expect(screen.getByText('2024-06-16')).toBeInTheDocument();
    expect(screen.getByText('REF-001')).toBeInTheDocument();
    expect(screen.getByText('Invoice Payment')).toBeInTheDocument();
  });

  it('omits optional settlement fields when not present', async () => {
    mockGetTransactionDetails.mockResolvedValue(
      makeTransactionData({ settlementDetails: {} }),
    );
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Settlement Details')).toBeInTheDocument();
    });
    expect(screen.queryByText('Settlement Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Reference')).not.toBeInTheDocument();
    expect(screen.queryByText('Purpose')).not.toBeInTheDocument();
  });

  it('handles amountAndCurrency without optional fields', async () => {
    mockGetTransactionDetails.mockResolvedValue(
      makeTransactionData({
        amountAndCurrency: [{ originalAmount: 100 }],
      }),
    );
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Amount & Currency')).toBeInTheDocument();
    });
    expect(screen.getByText(/USD \$100/)).toBeInTheDocument();
    expect(screen.queryByText('Exchange Rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Converted Amount')).not.toBeInTheDocument();
  });

  it('handles empty iban on debtor/creditor in flow', async () => {
    mockGetTransactionDetails.mockResolvedValue(
      makeTransactionData({
        transactionFlow: {
          debtor: { name: 'D', account: { iban: '' }, bank: 'DB' },
          amount: { amount: 100 },
          creditor: { name: 'C', account: { iban: '' }, bankName: 'CB' },
        },
      }),
    );
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Transaction Flow')).toBeInTheDocument();
    });
  });

  it('renders IBAN masked in transaction flow', async () => {
    mockGetTransactionDetails.mockResolvedValue(makeTransactionData());
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Transaction Flow')).toBeInTheDocument();
    });
    // IBAN is sliced: first 4 chars + •••• + last 15 chars
    expect(screen.getByText(/US12.*5678901234567890/)).toBeInTheDocument();
  });

  it('renders multiple amount items with separator', async () => {
    mockGetTransactionDetails.mockResolvedValue(
      makeTransactionData({
        amountAndCurrency: [
          { originalAmount: 1000 },
          { originalAmount: 2000, convertedAmount: 2400 },
        ],
      }),
    );
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(screen.getByText('Amount & Currency')).toBeInTheDocument();
    });
  });

  it('shows backend unavailable hint in error state', async () => {
    mockGetTransactionDetails.mockRejectedValue(new Error('Network error'));
    render(
      <TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    await waitFor(() => {
      expect(
        screen.getByText(/backend transaction details service/i),
      ).toBeInTheDocument();
    });
  });
});
