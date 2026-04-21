import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransactionHistoryTab from '../transactionhistory/TransactionHistoryTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title }: any) => <div data-testid="voila-frame">{title}</div>,
}));

vi.mock('@/features/cases/hooks/useEntityMetadata', () => ({
  useEntityMetadata: () => ({
    entityMetadata: {
      creditorAccountId: 'CACC-001',
      debtorAccountId: 'DACC-001',
      creditorId: 'CRED-001',
      debtorId: 'DEB-001',
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe('TransactionHistoryTab', () => {
  it('shows no-alert message when alertId is 0', () => {
    render(
      <TransactionHistoryTab alertId={0} tenantId="DEFAULT" />,
    );
    expect(screen.getByText('Select an alert to view transaction history')).toBeInTheDocument();
  });

  it('renders with entity metadata', () => {
    render(
      <TransactionHistoryTab alertId={1} transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Creditor')).toBeInTheDocument();
    expect(screen.getByText('Debtor')).toBeInTheDocument();
  });
});
