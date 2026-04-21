import React from 'react';
import { render, screen } from '@testing-library/react';
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

describe('AlertHistoryTab', () => {
  it('shows error state when no transactionId', () => {
    render(<AlertHistoryTab tenantId="DEFAULT" />);
    expect(screen.getByText('Transaction Data Unavailable')).toBeInTheDocument();
  });

  it('renders VoilaFrame with transaction data', () => {
    render(
      <AlertHistoryTab transactionId="TXN-001" tenantId="DEFAULT" />,
    );
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
    expect(screen.getByText('Alert History')).toBeInTheDocument();
  });

  it('renders VoilaFrame with caseId and transactionId', () => {
    render(
      <AlertHistoryTab caseId={1} transactionId="TXN-002" tenantId="T1" />,
    );
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
  });
});
