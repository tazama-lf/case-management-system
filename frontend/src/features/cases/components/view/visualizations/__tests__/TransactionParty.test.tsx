import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TransactionParty } from '../transactiondetails/components/TransactionParty';

describe('TransactionParty', () => {
  const props = {
    type: 'debtor' as const,
    name: 'John Doe',
    account: 'ACC123456',
    address: '123 Main St',
    country: 'US',
    riskLevel: 'High',
  };

  it('renders party information', () => {
    render(<TransactionParty {...props} />);
    expect(screen.getByText('debtor')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('ACC123456')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('US')).toBeInTheDocument();
  });

  it('displays correct risk level badge', () => {
    render(<TransactionParty {...props} />);
    expect(screen.getByText('High Risk')).toBeInTheDocument();
  });

  it('applies correct risk colors for High', () => {
    render(<TransactionParty {...props} />);
    const badge = screen.getByText('High Risk');
    expect(badge.className).toContain('text-red-600');
  });

  it('applies correct risk colors for Low', () => {
    render(<TransactionParty {...props} riskLevel="Low" />);
    const badge = screen.getByText('Low Risk');
    expect(badge.className).toContain('text-green-600');
  });

  it('renders creditor type', () => {
    render(<TransactionParty {...props} type="creditor" />);
    expect(screen.getByText('creditor')).toBeInTheDocument();
  });
});
