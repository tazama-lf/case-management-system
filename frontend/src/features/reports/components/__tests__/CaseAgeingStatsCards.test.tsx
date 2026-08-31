import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CaseAgeingStatsCards from '../CaseAgeingStatsCards';
import type { CaseAgeingStats } from '../../types/reports.types';

// Replace the lazy-loaded StatsCard with a synchronous stub so the
// component renders immediately under the test environment instead of
// remaining stuck on the Suspense fallback skeletons - same approach as
// ReportStatsCards.test.tsx, since both now share this component.
vi.mock('../../../dashboard/components/StatsCard', () => ({
  __esModule: true,
  default: ({ title, value }: { title: string; value: number | string }) => (
    <div data-testid="stats-card">
      <div>{title}</div>
      <div>{value}</div>
    </div>
  ),
}));

describe('CaseAgeingStatsCards', () => {
  const mockStats: CaseAgeingStats = {
    avgCaseAge: 12.5,
    avgResolutionTime: 18.3,
    casesOver15Days: 25,
    casesOver30Days: 10,
  };

  it('renders all four stat cards', async () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    await waitFor(() => {
      expect(screen.getByText('Avg. Case Age')).toBeInTheDocument();
    });
    expect(screen.getByText('Cases 16-29 Days')).toBeInTheDocument();
    expect(screen.getByText('Cases 30+ Days')).toBeInTheDocument();
    expect(screen.getByText('Avg. Resolution Time')).toBeInTheDocument();
  });

  it('displays formatted average case age', async () => {
    const { container } = render(<CaseAgeingStatsCards stats={mockStats} />);

    await waitFor(() => {
      expect(container.textContent).toContain('13 days'); // Math.round(12.5) = 13
    });
  });

  it('displays cases in the 16-29 day tier', async () => {
    const { container } = render(<CaseAgeingStatsCards stats={mockStats} />);

    await waitFor(() => {
      expect(container.textContent).toContain('25');
    });
  });

  it('displays cases in the 30+ day tier', async () => {
    const { container } = render(<CaseAgeingStatsCards stats={mockStats} />);

    await waitFor(() => {
      expect(container.textContent).toContain('10');
    });
  });

  it('renders N/A for avgCaseAge when there are no open cases (null, not 0)', async () => {
    const nullStats: CaseAgeingStats = {
      avgCaseAge: null,
      avgResolutionTime: null,
      casesOver15Days: 0,
      casesOver30Days: 0,
    };

    const { container } = render(<CaseAgeingStatsCards stats={nullStats} />);

    await waitFor(() => {
      // Both Avg. Case Age and Avg. Resolution Time render "N/A" for a null value.
      expect(screen.getAllByText('N/A').length).toBe(2);
    });
    expect(container.textContent).toContain('N/A');
  });

  it('handles undefined values', async () => {
    const undefinedStats: CaseAgeingStats = {
      avgCaseAge: undefined,
      avgResolutionTime: undefined,
      casesOver15Days: undefined,
      casesOver30Days: undefined,
    };

    render(<CaseAgeingStatsCards stats={undefinedStats} />);

    await waitFor(() => {
      expect(screen.getAllByText('N/A').length).toBe(2);
    });
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('handles NaN values', async () => {
    const nanStats: CaseAgeingStats = {
      avgCaseAge: NaN,
      avgResolutionTime: NaN,
      casesOver15Days: NaN,
      casesOver30Days: NaN,
    };

    render(<CaseAgeingStatsCards stats={nanStats} />);

    await waitFor(() => {
      expect(screen.getAllByText('N/A').length).toBe(2);
    });
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('rounds decimal values correctly', async () => {
    const decimalStats: CaseAgeingStats = {
      avgCaseAge: 12.7,
      avgResolutionTime: 18.9,
      casesOver15Days: 25,
      casesOver30Days: 10,
    };

    const { container } = render(<CaseAgeingStatsCards stats={decimalStats} />);

    await waitFor(() => {
      expect(container.textContent).toContain('13 days'); // Math.round(12.7) = 13
    });
  });

  it('handles zero values', async () => {
    const zeroStats: CaseAgeingStats = {
      avgCaseAge: 0,
      avgResolutionTime: 0,
      casesOver15Days: 0,
      casesOver30Days: 0,
    };

    render(<CaseAgeingStatsCards stats={zeroStats} />);

    await waitFor(() => {
      // Both Avg. Case Age and Avg. Resolution Time render "0 days" for a zero value.
      expect(screen.getAllByText('0 days').length).toBe(2);
    });
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });
});
