import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NetworkDetailsPanel from '../network-analysis/NetworkDetailsPanel';

describe('NetworkDetailsPanel', () => {
  const fields = [
    { label: 'Account ID', value: 'ACC-001' },
    { label: 'Risk Level', value: 'High', highlight: true },
    { label: 'Transactions', value: 42 },
  ];

  it('renders title and fields', () => {
    render(<NetworkDetailsPanel title="Account Details" fields={fields} />);
    expect(screen.getByText('Account Details')).toBeInTheDocument();
    expect(screen.getByText('Account ID')).toBeInTheDocument();
    expect(screen.getByText('ACC-001')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('highlights fields when highlight is true', () => {
    render(<NetworkDetailsPanel title="Details" fields={fields} />);
    const riskValue = screen.getByText('High');
    expect(riskValue.className).toContain('text-red-600');
  });

  it('renders summary section when provided', () => {
    const summaryFields = [
      { label: 'Total Volume', value: '$1,000,000' },
      { label: 'Flagged', value: 'Yes', highlight: true },
    ];
    render(
      <NetworkDetailsPanel
        title="Details"
        fields={fields}
        summaryTitle="Summary"
        summaryFields={summaryFields}
      />,
    );
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('$1,000,000')).toBeInTheDocument();
  });

  it('does not render summary when not provided', () => {
    render(<NetworkDetailsPanel title="Details" fields={fields} />);
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
  });
});
