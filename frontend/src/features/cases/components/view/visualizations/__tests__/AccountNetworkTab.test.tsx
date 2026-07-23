import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AccountNetworkTab from '../network-analysis/AccountNetworkTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title, notebookPath }: any) => (
    <div data-testid="voila-frame">
      <span>{title}</span>
      <span>{notebookPath}</span>
    </div>
  ),
}));

describe('AccountNetworkTab', () => {
  it('renders VoilaFrame with account network config', () => {
    render(<AccountNetworkTab entityId="ACC-001" tenantId="DEFAULT" />);
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
    expect(screen.getByText('Account Network Analysis')).toBeInTheDocument();
    expect(screen.getByText('account-network.ipynb')).toBeInTheDocument();
  });
});
