import React from 'react';
import { render, screen, act } from '@testing-library/react';
import StatsCards from '../StatsCards';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockStats = {
  totalAlerts: 10,
  availableCases: 5,
  openAssignedCases: 7,
  overdueCases: 2,
  resolvedThisMonth: 3,
};

describe('StatsCards component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all five stats cards with correct titles and values', async () => {
    render(<StatsCards stats={mockStats} />);

    // Run all timers to finish animations inside each StatsCard
    act(() => {
      vi.runAllTimers();
    });

    // Verify titles
    expect(screen.getByText('Total Cases')).toBeInTheDocument();
    expect(screen.getByText('Available Cases')).toBeInTheDocument();
    expect(screen.getByText('Open & Assigned Cases')).toBeInTheDocument();
    expect(screen.getByText('Overdue Cases')).toBeInTheDocument();
    expect(screen.getByText('Resolved This Month')).toBeInTheDocument();

    // Verify values (formatted numbers)
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
