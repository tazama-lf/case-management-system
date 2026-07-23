import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransactionNetworkTab from '../network-analysis/TransactionNetworkTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title, notebookPath }: any) => (
    <div data-testid="voila-frame">
      <span>{title}</span>
      <span>{notebookPath}</span>
    </div>
  ),
}));

describe('TransactionNetworkTab', () => {
  it('renders VoilaFrame with transaction network config', () => {
    render(
      <TransactionNetworkTab
        entityAccountId="ACC-001"
        tenantId="DEFAULT"
        timeRange="month"
      />,
    );
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
    expect(screen.getByText('Transaction Network')).toBeInTheDocument();
    expect(screen.getByText('transaction-network.ipynb')).toBeInTheDocument();
  });
});
