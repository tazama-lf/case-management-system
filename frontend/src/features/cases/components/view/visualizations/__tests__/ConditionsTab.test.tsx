import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConditionsTab from '../conditions/ConditionsTab';

vi.mock('../network-analysis/VoilaFrame', () => ({
  default: ({ title, notebookPath, queryParams }: any) => (
    <div data-testid="voila-frame">
      <span>{title}</span>
      <span>{notebookPath}</span>
      <span>{queryParams?.transactionId}</span>
    </div>
  ),
}));

describe('ConditionsTab', () => {
  it('renders VoilaFrame with conditions timeline', () => {
    render(<ConditionsTab transactionId="TXN-001" tenantId="DEFAULT" />);
    expect(screen.getByTestId('voila-frame')).toBeInTheDocument();
    expect(screen.getByText('Conditions Timeline')).toBeInTheDocument();
    expect(screen.getByText('conditions-timeline.ipynb')).toBeInTheDocument();
  });

  it('passes query params to VoilaFrame', () => {
    render(<ConditionsTab transactionId="TXN-002" tenantId="T1" />);
    expect(screen.getByText('TXN-002')).toBeInTheDocument();
  });
});
