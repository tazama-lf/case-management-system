import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import CaseAgeingStatsCards from '../CaseAgeingStatsCards';
import type { CaseAgeingStats } from '../../types/reports.types';

describe('CaseAgeingStatsCards', () => {
  const mockStats: CaseAgeingStats = {
    avgCaseAge: 12.5,
    avgResolutionTime: 18.3,
    casesOver15Days: 25,
    casesOver30Days: 10,
  };

  it('renders all stats cards', () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    expect(screen.getByText('Avg. Case Age')).toBeInTheDocument();
    expect(screen.getByText('Avg. Resolution Time')).toBeInTheDocument();
    expect(screen.getByText('Cases > 15 Days')).toBeInTheDocument();
    expect(screen.getByText('Cases > 30 Days')).toBeInTheDocument();
  });

  it('displays formatted average case age', () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    expect(screen.getByText('13 days')).toBeInTheDocument(); // Math.round(12.5) = 13
  });

  it('displays formatted average resolution time', () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    expect(screen.getByText('18 days')).toBeInTheDocument(); // Math.round(18.3) = 18
  });

  it('displays cases over 15 days', async () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    // Find the specific card container by its title
    const card = screen.getByText('Cases > 15 Days').closest('div[class*="bg-white"]');
    expect(card).toBeInTheDocument();
    
    // Wait for animation to complete and verify the correct number is displayed in this card
    // The StatsCard component animates from 0 to the target value over 1000ms
    await waitFor(
      () => {
        const cardElement = card as HTMLElement;
        expect(within(cardElement).getByText('25')).toBeInTheDocument();
      },
      { timeout: 3000, interval: 100 }, // Increased timeout and check interval for animation
    );
  });

  it('displays cases over 30 days', async () => {
    render(<CaseAgeingStatsCards stats={mockStats} />);

    // Find the specific card container by its title
    const card = screen.getByText('Cases > 30 Days').closest('div[class*="bg-white"]');
    expect(card).toBeInTheDocument();
    
    // Wait for animation to complete and verify the correct number is displayed in this card
    // The StatsCard component animates from 0 to the target value over 1000ms
    await waitFor(
      () => {
        const cardElement = card as HTMLElement;
        expect(within(cardElement).getByText('10')).toBeInTheDocument();
      },
      { timeout: 3000, interval: 100 }, // Increased timeout and check interval for animation
    );
  });

  it('handles null values', () => {
    const nullStats: CaseAgeingStats = {
      avgCaseAge: null,
      avgResolutionTime: null,
      casesOver15Days: null,
      casesOver30Days: null,
    };

    render(<CaseAgeingStatsCards stats={nullStats} />);

    expect(screen.getAllByText('0 days').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('handles undefined values', () => {
    const undefinedStats: CaseAgeingStats = {
      avgCaseAge: undefined,
      avgResolutionTime: undefined,
      casesOver15Days: undefined,
      casesOver30Days: undefined,
    };

    render(<CaseAgeingStatsCards stats={undefinedStats} />);

    expect(screen.getAllByText('0 days').length).toBeGreaterThan(0);
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

    expect(screen.getAllByText('0 days').length).toBeGreaterThan(0);
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
    expect(screen.getByText('19 days')).toBeInTheDocument(); // Math.round(18.9) = 19
  });

  it('handles zero values', () => {
    const zeroStats: CaseAgeingStats = {
      avgCaseAge: 0,
      avgResolutionTime: 0,
      casesOver15Days: 0,
      casesOver30Days: 0,
    };

    render(<CaseAgeingStatsCards stats={zeroStats} />);

    expect(screen.getAllByText('0 days').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });
});
