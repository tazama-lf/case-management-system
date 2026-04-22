import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NetworkAnalysisTab from '../NetworkAnalysisTab';

// Mock child components
vi.mock('../TransactionNetworkTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="transaction-network-tab">
      TransactionNetworkTab - entityAccountId:{' '}
      {String(props.entityAccountId ?? 'none')}
    </div>
  ),
}));

vi.mock('../AccountNetworkTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="account-network-tab">
      AccountNetworkTab - entityId: {String(props.entityId ?? 'none')}
    </div>
  ),
}));

vi.mock('../CounterpartyNetworkTab', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="counterparty-network-tab">
      CounterpartyNetworkTab - entityId: {String(props.entityId ?? 'none')}
    </div>
  ),
}));

const mockEntityMetadata = {
  debtorId: 'debtor-1',
  debtorAccountId: 'debtor-acc-1',
  debtorName: 'Debtor Name',
  creditorId: 'creditor-1',
  creditorAccountId: 'creditor-acc-1',
  creditorName: 'Creditor Name',
};

vi.mock('@/features/cases/hooks/useEntityMetadata', () => ({
  useEntityMetadata: vi.fn(() => ({
    entityMetadata: mockEntityMetadata,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Dynamically import to get a reference for overriding
import { useEntityMetadata } from '@/features/cases/hooks/useEntityMetadata';

describe('NetworkAnalysisTab', () => {
  const defaultProps = {
    caseId: 1,
    transactionId: 'TXN-123',
    alertId: 42,
    tenantId: 'tenant-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEntityMetadata).mockReturnValue({
      entityMetadata: mockEntityMetadata,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders the Network Navigator header', () => {
    render(<NetworkAnalysisTab {...defaultProps} />);

    expect(screen.getByText('Network Navigator')).toBeInTheDocument();
    expect(
      screen.getByText(/Visualize relationships and transaction flows/),
    ).toBeInTheDocument();
  });

  it('shows prompt when alertId is falsy', () => {
    render(<NetworkAnalysisTab {...defaultProps} alertId={0} />);

    expect(
      screen.getByText(/Select an alert to view navigator details/),
    ).toBeInTheDocument();
  });

  it('shows loading state when metadata is loading', () => {
    vi.mocked(useEntityMetadata).mockReturnValue({
      entityMetadata: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetworkAnalysisTab {...defaultProps} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows loading state when entityMetadata is undefined', () => {
    vi.mocked(useEntityMetadata).mockReturnValue({
      entityMetadata: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<NetworkAnalysisTab {...defaultProps} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders TransactionNetworkTab by default', () => {
    render(<NetworkAnalysisTab {...defaultProps} />);

    expect(screen.getByTestId('transaction-network-tab')).toBeInTheDocument();
  });

  it('passes creditor account ID to TransactionNetworkTab by default', () => {
    render(<NetworkAnalysisTab {...defaultProps} />);

    expect(screen.getByTestId('transaction-network-tab')).toHaveTextContent(
      'entityAccountId: creditor-acc-1',
    );
  });

  it('switches to AccountNetworkTab when account tab is clicked', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...defaultProps} />);

    await user.click(screen.getByText('Account Network'));

    expect(screen.getByTestId('account-network-tab')).toBeInTheDocument();
  });

  it('switches to CounterpartyNetworkTab when counterparty tab is clicked', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...defaultProps} />);

    await user.click(screen.getByText('Counterparty Network'));

    expect(screen.getByTestId('counterparty-network-tab')).toBeInTheDocument();
  });

  it('renders all three sub-tab buttons', () => {
    render(<NetworkAnalysisTab {...defaultProps} />);

    expect(screen.getByText('Transaction Network')).toBeInTheDocument();
    expect(screen.getByText('Account Network')).toBeInTheDocument();
    expect(screen.getByText('Counterparty Network')).toBeInTheDocument();
  });

  it('renders Creditor/Debtor toggle', () => {
    render(<NetworkAnalysisTab {...defaultProps} />);

    expect(screen.getByText('Creditor')).toBeInTheDocument();
    expect(screen.getByText('Debtor')).toBeInTheDocument();
  });

  it('switches to debtor entity role when Debtor button is clicked', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...defaultProps} />);

    await user.click(screen.getByText('Debtor'));

    expect(screen.getByTestId('transaction-network-tab')).toHaveTextContent(
      'entityAccountId: debtor-acc-1',
    );
  });

  it('passes debtor entity ID to AccountNetworkTab when debtor is selected', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...defaultProps} />);

    await user.click(screen.getByText('Debtor'));
    await user.click(screen.getByText('Account Network'));

    expect(screen.getByTestId('account-network-tab')).toHaveTextContent(
      'entityId: debtor-1',
    );
  });

  it('passes creditor entity ID to CounterpartyNetworkTab by default', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...defaultProps} />);

    await user.click(screen.getByText('Counterparty Network'));

    expect(screen.getByTestId('counterparty-network-tab')).toHaveTextContent(
      'entityId: creditor-1',
    );
  });

  it('renders time range dropdown and defaults to Month', () => {
    render(<NetworkAnalysisTab {...defaultProps} />);

    expect(screen.getByText('Month')).toBeInTheDocument();
  });

  it('opens time range dropdown on click', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...defaultProps} />);

    // Click the dropdown button (the one with "Month" text that has ChevronDownIcon)
    const dropdownButtons = screen.getAllByText('Month');
    await user.click(dropdownButtons[0]);

    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('All Time')).toBeInTheDocument();
  });

  it('selects a new time range from dropdown', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...defaultProps} />);

    // Open dropdown
    const monthButtons = screen.getAllByText('Month');
    await user.click(monthButtons[0]);

    // Select Year
    await user.click(screen.getByText('Year'));

    // Dropdown should close and Year should be displayed
    expect(screen.getByText('Year')).toBeInTheDocument();
  });

  it('highlights the active sub-tab', () => {
    render(<NetworkAnalysisTab {...defaultProps} />);

    const transactionButton = screen.getByText('Transaction Network');
    expect(transactionButton.closest('button')).toHaveClass('bg-indigo-600');
  });

  it('switches active sub-tab styling on click', async () => {
    const user = userEvent.setup();
    render(<NetworkAnalysisTab {...defaultProps} />);

    await user.click(screen.getByText('Account Network'));

    const accountButton = screen.getByText('Account Network');
    expect(accountButton.closest('button')).toHaveClass('bg-indigo-600');

    const transactionButton = screen.getByText('Transaction Network');
    expect(transactionButton.closest('button')).toHaveClass('bg-gray-100');
  });
});
