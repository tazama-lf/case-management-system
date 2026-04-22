import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertMetadata } from '../alertnavigator/components/AlertMetadata';

describe('AlertMetadata', () => {
  const props = {
    alertId: 'ALT-001',
    timestamp: '2024-01-01 12:00:00',
    transactionType: 'pacs.008',
    entity: 'TestBank',
    transactionId: 'TXN-001',
    reason: 'Suspicious activity detected',
  };

  it('renders all metadata fields', () => {
    render(<AlertMetadata {...props} />);
    expect(screen.getByText('Alert Metadata')).toBeInTheDocument();
    expect(screen.getByText('ALT-001')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01 12:00:00')).toBeInTheDocument();
    expect(screen.getByText('pacs.008')).toBeInTheDocument();
    expect(screen.getByText('TestBank')).toBeInTheDocument();
    expect(screen.getByText('TXN-001')).toBeInTheDocument();
    expect(
      screen.getByText('Suspicious activity detected'),
    ).toBeInTheDocument();
  });

  it('renders blockReason when provided', () => {
    render(<AlertMetadata {...props} blockReason="Sanctioned entity" />);
    expect(screen.getByText('Sanctioned entity')).toBeInTheDocument();
  });

  it('does not render blockReason when not provided', () => {
    render(<AlertMetadata {...props} />);
    expect(screen.queryByText('Block Reason')).not.toBeInTheDocument();
  });

  it('uses default entity when not provided', () => {
    const { entity, ...propsWithoutEntity } = props;
    render(<AlertMetadata {...propsWithoutEntity} />);
    expect(screen.getByText('Binance')).toBeInTheDocument();
  });
});
