import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseAgeingStatsCards from '../CaseAgeingStatsCards';
import type { CaseAgeingStats } from '../../types/reports.types';

describe('CaseAgeingStatsCards', () => {
  const mockStats: CaseAgeingStats = {
    avgCaseAge: 12.5,
    avgResolutionTime: 18.3,
    casesOver15Days: 25,
    casesOver30Days: 10,
  };

  it('renders the three open-backlog cards', () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    expect(screen.getByText('Avg. Case Age')).toBeInTheDocument();
    expect(screen.getByText('Cases 16-29 Days')).toBeInTheDocument();
    expect(screen.getByText('Cases 30+ Days')).toBeInTheDocument();
    // Avg. Resolution Time moved to the Closed Throughput section - it's not
    // part of this (open-backlog) card row anymore.
    expect(screen.queryByText('Avg. Resolution Time')).not.toBeInTheDocument();
  });

  it('displays formatted average case age', () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    expect(screen.getByText('13 days')).toBeInTheDocument(); // Math.round(12.5) = 13
  });

  it('displays cases in the 16-29 day tier', () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    const card = screen
      .getByText('Cases 16-29 Days')
      .closest('div[class*="bg-white"]') as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.textContent).toContain('25');
  });

  it('displays cases in the 30+ day tier', () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    const card = screen
      .getByText('Cases 30+ Days')
      .closest('div[class*="bg-white"]') as HTMLElement;
    expect(card).toBeInTheDocument();
    expect(card.textContent).toContain('10');
  });

  it('renders N/A for avgCaseAge when there are no open cases (null, not 0)', () => {
    const nullStats: CaseAgeingStats = {
      avgCaseAge: null,
      avgResolutionTime: null,
      casesOver15Days: 0,
      casesOver30Days: 0,
    };

    render(<CaseAgeingStatsCards stats={nullStats} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('handles undefined values', () => {
    const undefinedStats: CaseAgeingStats = {
      avgCaseAge: undefined,
      avgResolutionTime: undefined,
      casesOver15Days: undefined,
      casesOver30Days: undefined,
    };

    render(<CaseAgeingStatsCards stats={undefinedStats} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('handles NaN values', () => {
    const nanStats: CaseAgeingStats = {
      avgCaseAge: NaN,
      avgResolutionTime: NaN,
      casesOver15Days: NaN,
      casesOver30Days: NaN,
    };

    render(<CaseAgeingStatsCards stats={nanStats} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('rounds decimal values correctly', () => {
    const decimalStats: CaseAgeingStats = {
      avgCaseAge: 12.7,
      avgResolutionTime: 18.9,
      casesOver15Days: 25,
      casesOver30Days: 10,
    };

    render(<CaseAgeingStatsCards stats={decimalStats} />);

    expect(screen.getByText('13 days')).toBeInTheDocument(); // Math.round(12.7) = 13
  });

  it('handles zero values', () => {
    const zeroStats: CaseAgeingStats = {
      avgCaseAge: 0,
      avgResolutionTime: 0,
      casesOver15Days: 0,
      casesOver30Days: 0,
    };

    render(<CaseAgeingStatsCards stats={zeroStats} />);

    expect(screen.getByText('0 days')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });
});
