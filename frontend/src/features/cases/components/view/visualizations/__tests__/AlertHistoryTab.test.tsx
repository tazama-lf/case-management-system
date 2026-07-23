import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import AlertHistoryTab from '../alerthistory/AlertHistoryTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title, notebookPath }: any) => (
    <div data-testid="voila-frame">
      <span>{title}</span>
      <span>{notebookPath}</span>
    </div>
  ),
}));

vi.mock('@/features/cases/hooks/useEntityMetadata', () => ({
  useEntityMetadata: () => ({
    entityMetadata: {
      creditorId: 'creditor-1',
      debtorId: 'debtor-1',
      creditorAccountId: 'creditor-account-1',
      debtorAccountId: 'debtor-account-1',
    },
  }),
}));

describe('AlertHistoryTab', () => {
  it('shows error state when no transactionId', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AlertHistoryTab alertId={1} tenantId="DEFAULT" />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText('Transaction Data Unavailable'),
    ).toBeInTheDocument();
  });

  it('renders VoilaFrame with transaction data', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AlertHistoryTab alertId={1} transactionId="TXN-001" tenantId="DEFAULT" />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alert History' })).toBeInTheDocument();
  });

  it('renders VoilaFrame with caseId and transactionId', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AlertHistoryTab alertId={1} caseId={1} transactionId="TXN-002" tenantId="T1" />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
  });
});
