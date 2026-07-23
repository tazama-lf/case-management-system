import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AlertNavigatorTab from '../alertnavigator/AlertNavigatorTab';

const mockGetAlertNavigator = vi.fn();

vi.mock('../alertnavigator/services', () => ({
  default: {
    getAlertNavigator: (...args: any[]) => mockGetAlertNavigator(...args),
  },
}));

const baseAlertMetadata = {
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
};

const buildTypology = (overrides: Record<string, any> = {}) => ({
  typologyId: 'typ-1',
  typologyCfg: 'Money Laundering',
  typologyScore: 90,
  alertThreshold: 50,
  interdictionThreshold: 80,
  ruleCount: 2,
  rules: [],
  ...overrides,
});

const buildResponse = (typologies: any[] = [buildTypology()]) => ({
  alertMetadata: baseAlertMetadata,
  typologies,
  statistics: { totalTypologies: typologies.length, totalRules: 0 },
  meta: { alertId: 1, tenantId: 'DEFAULT' },
});

describe('AlertNavigatorTab', () => {
  beforeEach(() => {
    mockGetAlertNavigator.mockReset();
  });

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
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders data on successful fetch', async () => {
    mockGetAlertNavigator.mockResolvedValue(buildResponse());
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(screen.getByText('Alert Navigator')).toBeInTheDocument();
    });
    expect(screen.getByText('Money Laundering')).toBeInTheDocument();
  });

  it('shows "No typologies triggered" when the typologies list is empty', async () => {
    mockGetAlertNavigator.mockResolvedValue(buildResponse([]));
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(screen.getByText('No typologies triggered')).toBeInTheDocument();
    });
  });

  describe('typology expand/collapse', () => {
    it('shows "No rules" when a typology has no rules and is expanded', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([buildTypology({ rules: [] })]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Money Laundering'));
      expect(screen.getByText('No rules')).toBeInTheDocument();
    });

    it('collapses back when clicking an expanded typology again', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([buildTypology({ rules: [] })]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Money Laundering'));
      expect(screen.getByText('No rules')).toBeInTheDocument();

      await user.click(screen.getByText('Money Laundering'));
      expect(screen.queryByText('No rules')).not.toBeInTheDocument();
    });

    it('only keeps one typology expanded at a time', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([
          buildTypology({
            typologyId: 'typ-1',
            typologyCfg: 'Money Laundering',
            rules: [],
          }),
          buildTypology({
            typologyId: 'typ-2',
            typologyCfg: 'Fraud',
            rules: [],
          }),
        ]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Money Laundering'));
      expect(screen.getAllByText('No rules')).toHaveLength(1);

      await user.click(screen.getByText('Fraud'));
      expect(screen.getAllByText('No rules')).toHaveLength(1);
    });
  });

  describe('rule detail rendering', () => {
    it('renders rule_desc and matched_band_reason when present', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([
          buildTypology({
            rules: [
              {
                ruleId: 'rule-030',
                ruleWeight: 100,
                subRef: '.01',
                independentVariable: null,
                rule_desc: 'Transaction exceeds threshold',
                matched_band_reason: 'Amount in high-risk band',
              },
            ],
          }),
        ]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Money Laundering'));

      expect(screen.getByText('rule-030')).toBeInTheDocument();
      expect(
        screen.getByText(/Rule Description:\s*Transaction exceeds threshold/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Band Reason:\s*Amount in high-risk band/),
      ).toBeInTheDocument();
    });

    it('does not render rule_desc or matched_band_reason when null', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([
          buildTypology({
            rules: [
              {
                ruleId: 'rule-040',
                ruleWeight: 100,
                subRef: '.01',
                independentVariable: null,
                rule_desc: null,
                matched_band_reason: null,
              },
            ],
          }),
        ]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Money Laundering'));

      expect(screen.getByText('rule-040')).toBeInTheDocument();
      expect(screen.queryByText(/Rule Description:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Band Reason:/)).not.toBeInTheDocument();
    });

    it('does not render rule_desc or matched_band_reason when undefined', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([
          buildTypology({
            rules: [
              {
                ruleId: 'rule-050',
                ruleWeight: 100,
              },
            ],
          }),
        ]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Money Laundering'));

      expect(screen.getByText('rule-050')).toBeInTheDocument();
      expect(screen.queryByText(/Rule Description:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Band Reason:/)).not.toBeInTheDocument();
    });

    it('renders rule_desc independently of matched_band_reason when only one is present', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([
          buildTypology({
            rules: [
              {
                ruleId: 'rule-060',
                ruleWeight: 100,
                rule_desc: 'Only description present',
                matched_band_reason: null,
              },
            ],
          }),
        ]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Money Laundering'));

      expect(
        screen.getByText(/Rule Description:\s*Only description present/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Band Reason:/)).not.toBeInTheDocument();
    });

    it('renders subRef and independentVariable when present', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([
          buildTypology({
            rules: [
              {
                ruleId: 'rule-070',
                ruleWeight: 100,
                subRef: '.03',
                independentVariable: 'Block',
              },
            ],
          }),
        ]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Money Laundering'));

      expect(screen.getByText(/Sub-ref:/)).toBeInTheDocument();
      expect(screen.getByText(/Independent Variable:/)).toBeInTheDocument();
    });

    it('renders multiple rules for an expanded typology', async () => {
      const user = userEvent.setup();
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([
          buildTypology({
            rules: [
              { ruleId: 'rule-080', ruleWeight: 50, rule_desc: 'First rule' },
              { ruleId: 'rule-081', ruleWeight: 60, rule_desc: 'Second rule' },
            ],
          }),
        ]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

      await waitFor(() => {
        expect(screen.getByText('Money Laundering')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Money Laundering'));

      expect(screen.getByText('rule-080')).toBeInTheDocument();
      expect(screen.getByText('rule-081')).toBeInTheDocument();
      expect(
        screen.getByText(/Rule Description:\s*First rule/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Rule Description:\s*Second rule/),
      ).toBeInTheDocument();
    });
  });

  it('renders the EFRuP flow processor banner when flowProcessorData is set', async () => {
    mockGetAlertNavigator.mockResolvedValue(
      buildResponse([buildTypology({ flowProcessorData: 'Block' })]),
    );
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

    await waitFor(() => {
      expect(screen.getByText('EFRuP:')).toBeInTheDocument();
    });
    expect(screen.getByText('Block')).toBeInTheDocument();
  });

  it('does not render the flow processor banner when no typology has flowProcessorData', async () => {
    mockGetAlertNavigator.mockResolvedValue(buildResponse());
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

    await waitFor(() => {
      expect(screen.getByText('Money Laundering')).toBeInTheDocument();
    });
    expect(screen.queryByText('EFRuP:')).not.toBeInTheDocument();
  });

  it('shows "No data available" when the fetch resolves with no data', async () => {
    mockGetAlertNavigator.mockResolvedValue(null);
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  it('falls back to a generic message when a non-Error is thrown', async () => {
    mockGetAlertNavigator.mockRejectedValue('boom');
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });

  describe('alert metadata fallbacks', () => {
    it('defaults status to PENDING when status is falsy', async () => {
      mockGetAlertNavigator.mockResolvedValue({
        ...buildResponse(),
        alertMetadata: { ...baseAlertMetadata, status: '' },
      });
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
      await waitFor(() => {
        expect(screen.getByText('PENDING')).toBeInTheDocument();
      });
    });

    it('shows N/A for evaluationId, timestamp, and amount when falsy, and formats a raw transactionId', async () => {
      mockGetAlertNavigator.mockResolvedValue({
        ...buildResponse(),
        alertMetadata: {
          ...baseAlertMetadata,
          evaluationId: '',
          timestamp: '',
          amount: 0,
          transactionId: 'plain-tx-id',
        },
      });
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
      await waitFor(() => {
        expect(screen.getByText('Alert Navigator')).toBeInTheDocument();
      });

      expect(screen.getAllByText('N/A')).toHaveLength(2);
      expect(screen.getByText(/N\/A\s*USD/)).toBeInTheDocument();
      expect(screen.getByText('plain-tx-id')).toBeInTheDocument();
    });

    it('extracts the second segment of a "||"-delimited transactionId', async () => {
      mockGetAlertNavigator.mockResolvedValue({
        ...buildResponse(),
        alertMetadata: {
          ...baseAlertMetadata,
          transactionId: 'raw-ref||display-ref',
        },
      });
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
      await waitFor(() => {
        expect(screen.getByText('display-ref')).toBeInTheDocument();
      });
    });

    it('renders the block status section when blockReason is present', async () => {
      mockGetAlertNavigator.mockResolvedValue({
        ...buildResponse(),
        alertMetadata: {
          ...baseAlertMetadata,
          blockReason: 'Manually blocked',
        },
      });
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
      await waitFor(() => {
        expect(screen.getByText('Block Status')).toBeInTheDocument();
      });
      expect(screen.getByText(/Manually blocked/)).toBeInTheDocument();
    });
  });

  describe('typology score color thresholds', () => {
    it('uses the orange styling for scores between 60 and 79', async () => {
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([buildTypology({ typologyScore: 70 })]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
      await waitFor(() => {
        expect(screen.getByText(/Typology Score: 70.00/)).toBeInTheDocument();
      });
      expect(screen.getByText(/Typology Score: 70.00/)).toHaveClass(
        'text-orange-700',
      );
    });

    it('uses the yellow styling for scores below 60', async () => {
      mockGetAlertNavigator.mockResolvedValue(
        buildResponse([buildTypology({ typologyScore: 40 })]),
      );
      render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
      await waitFor(() => {
        expect(screen.getByText(/Typology Score: 40.00/)).toBeInTheDocument();
      });
      expect(screen.getByText(/Typology Score: 40.00/)).toHaveClass(
        'text-yellow-700',
      );
    });
  });

  it('falls back to "no-id"/"no-cfg" keys when typologyId and typologyCfg are missing', async () => {
    mockGetAlertNavigator.mockResolvedValue(
      buildResponse([
        buildTypology({ typologyId: undefined, typologyCfg: undefined }),
      ]),
    );
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);
    await waitFor(() => {
      expect(screen.getByText(/Typology Score:/)).toBeInTheDocument();
    });
  });

  it('renders statistics summary values', async () => {
    mockGetAlertNavigator.mockResolvedValue({
      ...buildResponse([buildTypology({ typologyScore: 80 })]),
      statistics: { totalTypologies: 1, totalRules: 3 },
    });
    render(<AlertNavigatorTab alertId={1} tenantId="DEFAULT" />);

    await waitFor(() => {
      expect(screen.getByText('Typologies Triggered')).toBeInTheDocument();
    });

    const typologiesCard = screen
      .getByText('Typologies Triggered')
      .closest('div')?.parentElement as HTMLElement;
    expect(within(typologiesCard).getByText('1')).toBeInTheDocument();

    expect(screen.getByText('Rules Passed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Avg Score')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });
});
