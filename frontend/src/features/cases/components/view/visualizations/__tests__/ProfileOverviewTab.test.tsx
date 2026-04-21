import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfileOverviewTab from '../profileoverview/ProfileOverviewTab';

const mockGenerateProfile = vi.fn();

vi.mock('../../../services/profileService', () => ({
  profileService: {
    generateProfile: (...args: any[]) => mockGenerateProfile(...args),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

describe('ProfileOverviewTab', () => {
  it('shows error when alertId is not provided', () => {
    render(<ProfileOverviewTab />);
    expect(screen.getByText('Alert ID is required to generate profile')).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    mockGenerateProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfileOverviewTab alertId={1} />);
    // Loading state shows spinner
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows error on fetch failure', async () => {
    mockGenerateProfile.mockRejectedValue(new Error('Service error'));
    render(<ProfileOverviewTab alertId={1} />);
    await waitFor(() => {
      expect(screen.getByText('Service error')).toBeInTheDocument();
    });
  });
});
