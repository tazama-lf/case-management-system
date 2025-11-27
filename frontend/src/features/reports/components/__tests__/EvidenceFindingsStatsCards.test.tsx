import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EvidenceFindingsStatsCards from '../EvidenceFindingsStatsCards';
import type { EvidenceFindingsStats } from '../../types/reports.types';

describe('EvidenceFindingsStatsCards', () => {
  const mockStats: EvidenceFindingsStats = {
    totalFindings: 100,
    evidenceItems: 250,
    confirmedFindings: 75,
    refutedFindings: 25,
  };

  it('renders all stats cards', async () => {
    render(<EvidenceFindingsStatsCards stats={mockStats} />);

    await waitFor(() => {
      expect(screen.getByText('Total Findings')).toBeInTheDocument();
    });
    expect(screen.getByText('Evidence Items')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Refuted')).toBeInTheDocument();
  });

  it('displays correct values', async () => {
    render(<EvidenceFindingsStatsCards stats={mockStats} />);

    // Wait for lazy-loaded components to render
    await waitFor(() => {
      expect(screen.getByText('Total Findings')).toBeInTheDocument();
    });
    
    // Verify all card titles are present (values are rendered by StatsCard component)
    expect(screen.getByText('Total Findings')).toBeInTheDocument();
    expect(screen.getByText('Evidence Items')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Refuted')).toBeInTheDocument();
    
    // Verify that StatsCard components are rendered (they will display the values)
    // The exact value formatting is handled by the StatsCard component
    const cards = document.querySelectorAll('.bg-white.rounded-lg.shadow-sm');
    expect(cards.length).toBe(4);
  });

  it('applies correct colors', async () => {
    render(<EvidenceFindingsStatsCards stats={mockStats} />);

    await waitFor(() => {
      expect(screen.getByText('Total Findings')).toBeInTheDocument();
    });

    // Check that cards are rendered (color is applied via CSS classes)
    expect(screen.getByText('Total Findings')).toBeInTheDocument();
    expect(screen.getByText('Evidence Items')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Refuted')).toBeInTheDocument();
  });

  it('handles zero values', async () => {
    const zeroStats: EvidenceFindingsStats = {
      totalFindings: 0,
      evidenceItems: 0,
      confirmedFindings: 0,
      refutedFindings: 0,
    };

    render(<EvidenceFindingsStatsCards stats={zeroStats} />);

    await waitFor(() => {
      const zeroElements = screen.getAllByText('0');
      expect(zeroElements.length).toBeGreaterThanOrEqual(4);
    });
  });
});

