import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VisualizationsTab from '../VisualizationsTab';

vi.mock('../visualizations/alertnavigator/AlertNavigatorTab', () => ({
  default: () => <div data-testid="alert-navigator-tab">AlertNavigator</div>,
}));

vi.mock('../visualizations/transactiondetails/TransactionDetailsTab', () => ({
  default: () => (
    <div data-testid="transaction-details-tab">TransactionDetails</div>
  ),
}));

vi.mock('../visualizations/transactionhistory/TransactionHistoryTab', () => ({
  default: () => (
    <div data-testid="transaction-history-tab">TransactionHistory</div>
  ),
}));

vi.mock('../visualizations/network-analysis/NetworkAnalysisTab', () => ({
  default: () => <div data-testid="network-analysis-tab">NetworkAnalysis</div>,
}));

vi.mock('../visualizations/alerthistory/AlertHistoryTab', () => ({
  default: () => <div data-testid="alert-history-tab">AlertHistory</div>,
}));

vi.mock('../visualizations/conditions/ConditionsTab', () => ({
  default: () => <div data-testid="conditions-tab">Conditions</div>,
}));

vi.mock('../visualizations/profileoverview/ProfileOverviewTab', () => ({
  default: () => <div data-testid="profile-overview-tab">ProfileOverview</div>,
}));

describe('VisualizationsTab', () => {
  const defaultProps = {
    alertId: 1,
    caseId: 10,
    transactionId: 'TXN-001',
  };

  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ tenantId: 'DEFAULT' }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders with default alert navigator tab active', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Alert Navigator')).toBeInTheDocument();
    expect(screen.getByTestId('alert-navigator-tab')).toBeInTheDocument();
  });

  it('shows all sub-tab labels', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Alert Navigator')).toBeInTheDocument();
    expect(screen.getByText('Transaction Details')).toBeInTheDocument();
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Network Analysis')).toBeInTheDocument();
    expect(screen.getByText('Alert History')).toBeInTheDocument();
    expect(screen.getByText('Conditions')).toBeInTheDocument();
    expect(screen.getByText('Profile Overview')).toBeInTheDocument();
  });

  it('switches to transaction details tab', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('Transaction Details'));
    expect(screen.getByTestId('transaction-details-tab')).toBeInTheDocument();
  });

  it('switches to network analysis tab', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    const buttons = screen.getAllByText('Network Analysis');
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByTestId('network-analysis-tab')).toBeInTheDocument();
    });
  });

  it('switches to transaction history tab', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('Transaction History'));
    expect(screen.getByTestId('transaction-history-tab')).toBeInTheDocument();
  });

  it('switches to alert history tab', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('Alert History'));
    expect(screen.getByTestId('alert-history-tab')).toBeInTheDocument();
  });

  it('switches to conditions tab', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('Conditions'));
    expect(screen.getByTestId('conditions-tab')).toBeInTheDocument();
  });

  it('switches to profile overview tab', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('Profile Overview'));
    expect(screen.getByTestId('profile-overview-tab')).toBeInTheDocument();
  });

  it('shows fallback message for network analysis when alertId is missing', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab caseId={10} transactionId="TXN-001" />
      </QueryClientProvider>,
    );
    const buttons = screen.getAllByText('Network Analysis');
    fireEvent.click(buttons[0]);
    expect(
      screen.getByText('Select an alert to view network analysis'),
    ).toBeInTheDocument();
  });

  it('shows fallback message for transaction history when alertId is missing', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab caseId={10} transactionId="TXN-001" />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText('Transaction History'));
    expect(
      screen.getByText('Select an alert to view transaction history'),
    ).toBeInTheDocument();
  });

  it('handles missing tenantId from localStorage', () => {
    localStorage.removeItem('user');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('alert-navigator-tab')).toBeInTheDocument();
  });

  it('handles invalid JSON in localStorage', () => {
    localStorage.setItem('user', 'invalid-json');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('alert-navigator-tab')).toBeInTheDocument();
  });

  it('handles user without tenantId in localStorage', () => {
    localStorage.setItem('user', JSON.stringify({}));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <VisualizationsTab {...defaultProps} />
      </QueryClientProvider>,
    );
    // Network analysis without tenantId should show fallback
    const buttons = screen.getAllByText('Network Analysis');
    fireEvent.click(buttons[0]);
    expect(
      screen.getByText('Select an alert to view network analysis'),
    ).toBeInTheDocument();
  });
});
