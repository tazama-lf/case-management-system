import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import InvestigatorStatsCards from '../InvestigatorStatsCards';
import type { InvestigatorStats } from '../../types/reports.types';

describe('InvestigatorStatsCards', () => {
  const mockStats: InvestigatorStats = {
    totalInvestigators: 10,
    avgCasesPerInvestigator: 15.5,
    avgResolutionTime: 12.3,
    caseClosureRate: 85.7,
  };

  it('renders all stats cards', async () => {
    render(<InvestigatorStatsCards stats={mockStats} />);

    await waitFor(() => {
      expect(screen.getByText('Total Investigators')).toBeInTheDocument();
    });
    expect(screen.getByText('Avg. Cases per Investigator')).toBeInTheDocument();
    expect(screen.getByText('Avg. Resolution Time')).toBeInTheDocument();
    expect(screen.getByText('Case Closure Rate')).toBeInTheDocument();
  });

  it('displays formatted values', async () => {
    const { container } = render(<InvestigatorStatsCards stats={mockStats} />);

    // Wait for StatsCard animation
    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(container.textContent).toContain('10');
    expect(container.textContent).toContain('15.5');
    expect(container.textContent).toContain('12 days');
    expect(container.textContent).toContain('86%');
  });

  it('handles null values', async () => {
    const nullStats: InvestigatorStats = {
      totalInvestigators: null as any,
      avgCasesPerInvestigator: null as any,
      avgResolutionTime: null as any,
      caseClosureRate: null as any,
    };

    const { container } = render(<InvestigatorStatsCards stats={nullStats} />);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(container.textContent).toContain('0');
    expect(container.textContent).toContain('0 days');
    expect(container.textContent).toContain('0%');
  });

  it('handles undefined values', async () => {
    const undefinedStats: InvestigatorStats = {
      totalInvestigators: undefined as any,
      avgCasesPerInvestigator: undefined as any,
      avgResolutionTime: undefined as any,
      caseClosureRate: undefined as any,
    };

    const { container } = render(
      <InvestigatorStatsCards stats={undefinedStats} />,
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(container.textContent).toContain('0');
  });

  it('handles string values', async () => {
    const stringStats: InvestigatorStats = {
      totalInvestigators: '10' as any,
      avgCasesPerInvestigator: '15.5' as any,
      avgResolutionTime: '12.3' as any,
      caseClosureRate: '85.7' as any,
    };

    const { container } = render(
      <InvestigatorStatsCards stats={stringStats} />,
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(container.textContent).toContain('10');
  });

  it('formats numbers with correct decimals', async () => {
    const { container } = render(<InvestigatorStatsCards stats={mockStats} />);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    // avgCasesPerInvestigator should have 1 decimal
    expect(container.textContent).toContain('15.5');
    // avgResolutionTime should be rounded (12 days)
    expect(container.textContent).toContain('12 days');
    // caseClosureRate should be rounded (86%)
    expect(container.textContent).toContain('86%');
  });

  it('handles zero values', async () => {
    const zeroStats: InvestigatorStats = {
      totalInvestigators: 0,
      avgCasesPerInvestigator: 0,
      avgResolutionTime: 0,
      caseClosureRate: 0,
    };

    const { container } = render(<InvestigatorStatsCards stats={zeroStats} />);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(container.textContent).toContain('0');
  });
});
