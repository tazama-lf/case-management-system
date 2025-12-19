import React from 'react';
import { render, screen, act } from '@testing-library/react';
import StatsCards from '../StatsCards';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockStats = {
  totalAlerts: 10,
  highPriorityAlerts: 5,
  openCases: 7,
  casesResolvedThisWeek: 3,
};

describe('StatsCards component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all four stats cards with correct titles and values', async () => {
    render(<StatsCards stats={mockStats} />);

    // Run all timers to finish animations inside each StatsCard
    act(() => {
      vi.runAllTimers();
    });

    // Verify titles
    expect(screen.getByText('Total Cases')).toBeInTheDocument();
    expect(screen.getByText('High Priority Cases')).toBeInTheDocument();
    expect(screen.getByText('Open Cases')).toBeInTheDocument();
    expect(screen.getByText('Resolved This Month')).toBeInTheDocument();

    // Verify values (formatted numbers)
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
