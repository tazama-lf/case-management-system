import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CounterpartyNetworkTab from '../network-analysis/CounterpartyNetworkTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title, notebookPath }: any) => (
    <div data-testid="voila-frame">
      <span>{title}</span>
      <span>{notebookPath}</span>
    </div>
  ),
}));

describe('CounterpartyNetworkTab', () => {
  it('renders VoilaFrame with counterparty network config', () => {
    render(
      <CounterpartyNetworkTab
        entityId="ENT-001"
        tenantId="DEFAULT"
        timeRange="month"
      />,
    );
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
    expect(screen.getByText('Counterparty Network Analysis')).toBeInTheDocument();
    expect(screen.getByText('counterparty-network.ipynb')).toBeInTheDocument();
  });
});
