import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AlertHistoryTab from '../alerthistory/AlertHistoryTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title, notebookPath }: any) => (
    <div data-testid="voila-frame">
      <span>{title}</span>
      <span>{notebookPath}</span>
    </div>
  ),
}));

const mockUseEntityMetadata = vi.fn();

vi.mock('@/features/cases/hooks/useEntityMetadata', () => ({
  useEntityMetadata: (...args: unknown[]) => mockUseEntityMetadata(...args),
}));

const defaultMetadata = {
  entityMetadata: {
    creditorId: 'creditor-1',
    debtorId: 'debtor-1',
    creditorAccountId: 'creditor-account-1',
    debtorAccountId: 'debtor-account-1',
  },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

describe('AlertHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEntityMetadata.mockReturnValue(defaultMetadata);
  });

  it('shows a "no data" error state instead of forwarding undefined account IDs when the metadata lookup 404s', () => {
    mockUseEntityMetadata.mockReturnValue({
      entityMetadata: undefined,
      isLoading: false,
      error: new Error('No transaction found for alert 1'),
      refetch: vi.fn(),
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AlertHistoryTab alertId={1} transactionId="TXN-001" tenantId="DEFAULT" />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText('No transaction data available'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('voila-frame')).not.toBeInTheDocument();
  });
  it('shows a "no data" error state when entityMetadata is a truthy all-empty stub (defense in depth)', () => {
    mockUseEntityMetadata.mockReturnValue({
      entityMetadata: {},
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AlertHistoryTab alertId={1} transactionId="TXN-001" tenantId="DEFAULT" />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText('No transaction data available'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('voila-frame')).not.toBeInTheDocument();
  });

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
