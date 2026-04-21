import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfileOverviewTab from '../profileoverview/ProfileOverviewTab';

const mockGenerateProfile = vi.fn();

vi.mock('@/features/cases/services/profileService', () => ({
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
  it('shows unable to display message when alertId is not provided', () => {
    render(<ProfileOverviewTab />);
    expect(screen.getByText('Unable to display profile data')).toBeInTheDocument();
  });

  it('shows loading state while fetching', () => {
    mockGenerateProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    // Loading state shows spinner
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows error on fetch failure', async () => {
    mockGenerateProfile.mockRejectedValue(new Error('Service error'));
    render(<ProfileOverviewTab alertId={1} transactionId="tx-1" />);
    await waitFor(() => {
      expect(screen.getByText('Service error')).toBeInTheDocument();
    });
  });
});
