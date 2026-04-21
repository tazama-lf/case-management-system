import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VisualizationsTab from '../VisualizationsTab';

vi.mock('../visualizations/alertnavigator/AlertNavigatorTab', () => ({
  default: () => <div data-testid="alert-navigator-tab">AlertNavigator</div>,
}));

vi.mock('../visualizations/transactiondetails/TransactionDetailsTab', () => ({
  default: () => <div data-testid="transaction-details-tab">TransactionDetails</div>,
}));

vi.mock('../visualizations/transactionhistory/TransactionHistoryTab', () => ({
  default: () => <div data-testid="transaction-history-tab">TransactionHistory</div>,
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
    render(<VisualizationsTab {...defaultProps} />);
    expect(screen.getByText('Alert Navigator')).toBeInTheDocument();
    expect(screen.getByTestId('alert-navigator-tab')).toBeInTheDocument();
  });

  it('shows all sub-tab labels', () => {
    render(<VisualizationsTab {...defaultProps} />);
    expect(screen.getByText('Alert Navigator')).toBeInTheDocument();
    expect(screen.getByText('Transaction Details')).toBeInTheDocument();
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Network Analysis')).toBeInTheDocument();
    expect(screen.getByText('Alert History')).toBeInTheDocument();
  });

  it('switches to transaction details tab', () => {
    render(<VisualizationsTab {...defaultProps} />);
    fireEvent.click(screen.getByText('Transaction Details'));
    expect(screen.getByTestId('transaction-details-tab')).toBeInTheDocument();
  });

  it('switches to network analysis tab', async () => {
    render(<VisualizationsTab {...defaultProps} />);
    const buttons = screen.getAllByText('Network Analysis');
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(screen.getByTestId('network-analysis-tab')).toBeInTheDocument();
    });
  });
});
