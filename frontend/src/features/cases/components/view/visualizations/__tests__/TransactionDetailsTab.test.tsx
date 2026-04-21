import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransactionDetailsTab from '../transactiondetails/TransactionDetailsTab';

const mockGetTransactionDetails = vi.fn();

vi.mock('../transactiondetails/services/service', () => ({
  default: {
    getTransactionDetails: (...args: any[]) => mockGetTransactionDetails(...args),
  },
}));

describe('TransactionDetailsTab', () => {
  it('shows no-transaction message when transactionId is not provided', () => {
    render(<TransactionDetailsTab tenantId="DEFAULT" />);
    expect(screen.getByText('Select a transaction to view details')).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    mockGetTransactionDetails.mockReturnValue(new Promise(() => {}));
    render(<TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state on failure', async () => {
    mockGetTransactionDetails.mockRejectedValue(new Error('Service unavailable'));
    render(<TransactionDetailsTab transactionId="TXN-001" tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(screen.getByText(/Transaction Data Unavailable/)).toBeInTheDocument();
    });
  });
});
