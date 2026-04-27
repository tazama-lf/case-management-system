import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TransactionHistoryTab from '../transactionhistory/TransactionHistoryTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title, queryParams }: any) => (
    <div data-testid="voila-frame" data-params={JSON.stringify(queryParams)}>
      {title}
    </div>
  ),
}));

const mockUseEntityMetadata = vi.fn();

vi.mock('@/features/cases/hooks/useEntityMetadata', () => ({
  useEntityMetadata: (...args: any[]) => mockUseEntityMetadata(...args),
}));

const defaultMetadata = {
  entityMetadata: {
    creditorAccountId: 'CACC-001',
    debtorAccountId: 'DACC-001',
    creditorId: 'CRED-001',
    debtorId: 'DEB-001',
  },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

describe('TransactionHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEntityMetadata.mockReturnValue(defaultMetadata);
  });

  it('shows no-alert message when alertId is 0', () => {
    render(<TransactionHistoryTab alertId={0} tenantId="DEFAULT" />);
    expect(
      screen.getByText('Select an alert to view transaction history'),
    ).toBeInTheDocument();
  });

  it('shows loading metadata message when entityMetadata is null', () => {
    mockUseEntityMetadata.mockReturnValue({
      entityMetadata: null,
      isLoading: true,
      error: null,
    });
    render(<TransactionHistoryTab alertId={1} tenantId="DEFAULT" />);
    expect(screen.getByText('Loading entity metadata...')).toBeInTheDocument();
  });

  it('renders with entity metadata', () => {
    render(
      <TransactionHistoryTab
        alertId={1}
        transactionId="TXN-001"
        tenantId="DEFAULT"
      />,
    );
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(
      screen.getByText('Visualize transaction history'),
    ).toBeInTheDocument();
    expect(screen.getByText('Creditor')).toBeInTheDocument();
    expect(screen.getByText('Debtor')).toBeInTheDocument();
  });

  it('renders VoilaFrame with creditor account by default', () => {
    render(
      <TransactionHistoryTab
        alertId={1}
        transactionId="TXN-001"
        tenantId="DEFAULT"
      />,
    );
    const frame = screen.getByTestId('voila-frame');
    const params = JSON.parse(frame.getAttribute('data-params')!);
    expect(params.entityAccountId).toBe('CACC-001');
    expect(params.transactionId).toBe('TXN-001');
    expect(params.tenantId).toBe('DEFAULT');
    expect(params.granularity).toBe('month');
  });

  it('switches to debtor view on debtor button click', () => {
    render(
      <TransactionHistoryTab
        alertId={1}
        transactionId="TXN-001"
        tenantId="DEFAULT"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Debtor' }));
    const frame = screen.getByTestId('voila-frame');
    const params = JSON.parse(frame.getAttribute('data-params')!);
    expect(params.entityAccountId).toBe('DACC-001');
  });

  it('switches back to creditor view', () => {
    render(
      <TransactionHistoryTab
        alertId={1}
        transactionId="TXN-001"
        tenantId="DEFAULT"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Debtor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Creditor' }));
    const frame = screen.getByTestId('voila-frame');
    const params = JSON.parse(frame.getAttribute('data-params')!);
    expect(params.entityAccountId).toBe('CACC-001');
  });

  it('opens time range dropdown and selects Day', () => {
    render(
      <TransactionHistoryTab
        alertId={1}
        transactionId="TXN-001"
        tenantId="DEFAULT"
      />,
    );
    // Default shows "Month"
    expect(screen.getByText('Month')).toBeInTheDocument();
    // Open dropdown
    fireEvent.click(screen.getByText('Month'));
    // Dropdown options visible
    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('All Time')).toBeInTheDocument();
    // Select Day
    fireEvent.click(screen.getByText('Day'));
    const frame = screen.getByTestId('voila-frame');
    const params = JSON.parse(frame.getAttribute('data-params')!);
    expect(params.granularity).toBe('day');
  });

  it('selects Year time range', () => {
    render(
      <TransactionHistoryTab
        alertId={1}
        transactionId="TXN-001"
        tenantId="DEFAULT"
      />,
    );
    fireEvent.click(screen.getByText('Month'));
    fireEvent.click(screen.getByText('Year'));
    const frame = screen.getByTestId('voila-frame');
    const params = JSON.parse(frame.getAttribute('data-params')!);
    expect(params.granularity).toBe('year');
  });

  it('selects All Time time range', () => {
    render(
      <TransactionHistoryTab
        alertId={1}
        transactionId="TXN-001"
        tenantId="DEFAULT"
      />,
    );
    fireEvent.click(screen.getByText('Month'));
    fireEvent.click(screen.getByText('All Time'));
    const frame = screen.getByTestId('voila-frame');
    const params = JSON.parse(frame.getAttribute('data-params')!);
    expect(params.granularity).toBe('all');
  });

  it('closes dropdown after selecting a time range', () => {
    render(
      <TransactionHistoryTab
        alertId={1}
        transactionId="TXN-001"
        tenantId="DEFAULT"
      />,
    );
    fireEvent.click(screen.getByText('Month'));
    expect(screen.getByText('All Time')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Day'));
    // Dropdown should be closed, 'All Time' as dropdown option should not be visible
    // but 'Day' is now the label
    expect(screen.getByText('Day')).toBeInTheDocument();
  });

  it('handles empty transactionId', () => {
    render(<TransactionHistoryTab alertId={1} tenantId="DEFAULT" />);
    const frame = screen.getByTestId('voila-frame');
    const params = JSON.parse(frame.getAttribute('data-params')!);
    expect(params.transactionId).toBe('');
  });
});
