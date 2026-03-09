import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateTransactionProfileModal from '../GenerateTransactionProfileModal';
import { profileService } from '../../../services/profileService';

vi.mock('../../../services/profileService', () => ({
  profileService: {
    generateProfile: vi.fn(),
    getProfile: vi.fn(),
  },
}));
vi.mock('recharts', () => ({
  BarChart: () => <div>BarChart</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Area: () => null,
  AreaChart: () => <div>AreaChart</div>,
}));

describe('GenerateTransactionProfileModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSaveProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (profileService.generateProfile as vi.Mock).mockResolvedValue({
      generatedAt: '2024-01-01',
      totalVolume: '100000',
      anomalies: 5,
      riskLevel: 'HIGH',
    });
    (profileService.getProfile as vi.Mock).mockResolvedValue(null);
  });

  it('does not render when open is false', () => {
    render(
      <GenerateTransactionProfileModal
        open={false}
        onClose={mockOnClose}
        caseId="CASE-123"
        onSaveProfile={mockOnSaveProfile}
      />,
    );
    expect(
      screen.queryByText(/Generate Transaction Profile|Transaction Profile/i),
    ).not.toBeInTheDocument();
  });

  it('renders modal when open', () => {
    render(
      <GenerateTransactionProfileModal
        open={true}
        onClose={mockOnClose}
        caseId="CASE-123"
        onSaveProfile={mockOnSaveProfile}
      />,
    );

    // The heading can be either "Transaction Profile" or "Generate Transaction Profile"
    expect(screen.getByText(/Transaction Profile/i)).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <GenerateTransactionProfileModal
        open={true}
        onClose={mockOnClose}
        caseId="CASE-123"
        onSaveProfile={mockOnSaveProfile}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /Close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
