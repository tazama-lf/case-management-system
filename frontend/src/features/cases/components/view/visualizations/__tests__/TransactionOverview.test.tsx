import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TransactionOverview } from '../transactiondetails/components/TransactionOverview';

describe('TransactionOverview', () => {
  const props = {
    transactionId: 'TXN-001',
    timestamp: '2024-01-01 12:00:00',
    type: 'pacs.008',
    amount: '5000.00',
    currency: 'USD',
    status: 'Completed',
  };

  it('renders all fields', () => {
    render(<TransactionOverview {...props} />);
    expect(screen.getByText('Transaction Overview')).toBeInTheDocument();
    expect(screen.getByText('TXN-001')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01 12:00:00')).toBeInTheDocument();
    expect(screen.getByText('pacs.008')).toBeInTheDocument();
    expect(screen.getByText('5000.00 USD')).toBeInTheDocument();
  });
});
