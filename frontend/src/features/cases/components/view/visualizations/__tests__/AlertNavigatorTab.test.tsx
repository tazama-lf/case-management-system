import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AlertNavigatorTab from '../alertnavigator/AlertNavigatorTab';

const mockGetAlertNavigator = vi.fn();

vi.mock('../alertnavigator/services', () => ({
  default: {
    getAlertNavigator: (...args: any[]) => mockGetAlertNavigator(...args),
  },
}));

describe('AlertNavigatorTab', () => {
  it('shows no-alert message when alertId is not provided', async () => {
    render(<AlertNavigatorTab tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(
        screen.getByText('Select an alert to view navigator details'),
      ).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', () => {
    mockGetAlertNavigator.mockReturnValue(new Promise(() => {}));
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    mockGetAlertNavigator.mockRejectedValue(new Error('Network error'));
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(
        screen.getByText('Alert Navigator Data Unavailable'),
      ).toBeInTheDocument();
    });
  });

  it('renders data on successful fetch', async () => {
    mockGetAlertNavigator.mockResolvedValue({
      alertMetadata: {
        alertId: 1,
        transactionId: 'tx-123',
        timestamp: '2024-01-01',
        transactionType: 'TRANSFER',
        amount: 1000,
        currency: 'USD',
        status: 'ACTIVE',
        reason: 'Suspicious',
        blockReason: '',
        evaluationId: 'eval-1',
      },
      typologies: [
        {
          typologyId: 'typ-1',
          typologyCfg: 'Money Laundering',
          typologyScore: 90,
          alertThreshold: 50,
          interdictionThreshold: 80,
          ruleCount: 2,
          flowProcessorData: 'Block',
          rules: [],
        },
      ],
      statistics: { totalTypologies: 1, totalRules: 2 },
      meta: { alertId: 1, tenantId: 'DEFAULT' },
    });
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(screen.getByText('Alert Navigator')).toBeInTheDocument();
      expect(screen.getByText('EFRuP:')).toBeInTheDocument();
      expect(screen.getByText('Block')).toBeInTheDocument();
    });
  });
});
