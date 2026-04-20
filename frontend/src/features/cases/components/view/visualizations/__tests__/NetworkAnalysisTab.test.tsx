import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NetworkAnalysisTab from '../network-analysis/NetworkAnalysisTab';

vi.mock('@/features/cases/hooks/useEntityMetadata', () => ({
  useEntityMetadata: () => ({
    entityMetadata: {
      creditorAccountId: 'ACC-001',
      debtorAccountId: 'ACC-002',
      creditorId: 'CRED-001',
      debtorId: 'DEB-001',
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../network-analysis/TransactionNetworkTab', () => ({
  default: ({ transactionId }: { transactionId?: string }) => (
    <div>
      <p>Upstream and downstream transaction flows</p>
      {transactionId && <span>{transactionId}</span>}
    </div>
  ),
}));

vi.mock('../network-analysis/AccountNetworkTab', () => ({
  default: () => <div><p>Accounts linked to counterparties</p></div>,
}));

vi.mock('../network-analysis/CounterpartyNetworkTab', () => ({
  default: () => <div><p>Counterparties linked to transactions</p></div>,
}));

describe('NetworkAnalysisTab', () => {
  const mockProps = {
    caseId: 123,
    transactionId: 'TXN-456',
    alertId: 1,
    tenantId: 'test-tenant',
  };

  it('renders without crashing', () => {
    render(<NetworkAnalysisTab {...mockProps} />);
    expect(screen.getByText(/Network Navigator/i)).toBeInTheDocument();
  });

  it('displays all three sub-tabs', () => {
    render(<NetworkAnalysisTab {...mockProps} />);
    expect(screen.getByText(/Transaction Network/i)).toBeInTheDocument();
    expect(screen.getByText(/Account Network/i)).toBeInTheDocument();
    expect(screen.getByText(/Counterparty Network/i)).toBeInTheDocument();
  });

  it('defaults to Transaction Network tab', () => {
    render(<NetworkAnalysisTab {...mockProps} />);
    expect(screen.getByText(/Upstream and downstream transaction flows/i)).toBeInTheDocument();
  });

  it('switches to Account Network tab when clicked', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...mockProps} />);

    const accountNetworkButton = screen.getByRole('button', { name: /Account Network/i });
    await user.click(accountNetworkButton);

    expect(screen.getByText(/Accounts linked to counterparties/i)).toBeInTheDocument();
  });

  it('switches to Counterparty Network tab when clicked', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...mockProps} />);

    const counterpartyNetworkButton = screen.getByRole('button', { name: /Counterparty Network/i });
    await user.click(counterpartyNetworkButton);

    expect(screen.getByText(/Counterparties linked to transactions/i)).toBeInTheDocument();
  });

  it('passes props to child components', () => {
    render(<NetworkAnalysisTab {...mockProps} />);

    // Check if transaction ID is displayed (in Transaction Network tab)
    expect(screen.getByText(mockProps.transactionId)).toBeInTheDocument();
  });
});
