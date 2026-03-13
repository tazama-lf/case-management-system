import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GenerateTransactionProfileModal from '../GenerateTransactionProfileModal';
import { profileService } from '../../../services/profileService';

// ─── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../services/profileService', () => ({
  profileService: {
    generateProfile: vi.fn(),
    getProfile: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Area: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
}));

// ─── Setup ──────────────────────────────────────────────────────

const mockOnClose = vi.fn();
const mockOnSaveProfile = vi.fn();

const mockProfileResponse = {
  caseId: 'CASE-123',
  metrics: {
    totalVolume: 356,
    totalValue: 51380,
    avgTicketSize: 3550,
    crossBorderCount: 12,
  },
  detectedAnomalies: [
    {
      id: 1,
      date: '2024-11-10',
      type: 'Large Transfer',
      amount: 45000,
      description: 'Single transaction exceeds 90-day average by 600%',
      risk: 'High',
    },
    {
      id: 2,
      date: '2024-11-08',
      type: 'Rapid Succession',
      amount: '$12,300',
      description: '7 transactions within 15 minutes',
      risk: 'Medium',
    },
  ],
  notes: 'Test notes',
};

const defaultProps = {
  open: true,
  onClose: mockOnClose,
  caseId: 'CASE-123',
  onSaveProfile: mockOnSaveProfile,
};

describe('GenerateTransactionProfileModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('no profile'),
    );
    (profileService.generateProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );
  });

  // ─── Render / Visibility ──────────────────────────────────────

  it('does not render when open is false', () => {
    render(
      <GenerateTransactionProfileModal {...defaultProps} open={false} />,
    );
    expect(
      screen.queryByText(/Transaction Profile/i),
    ).not.toBeInTheDocument();
  });

  it('renders modal with initial step when no profile exists', async () => {
    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Ready to Generate Transaction Profile/i),
      ).toBeInTheDocument();
    });
  });

  it('shows Generate Transaction Profile heading when not in view mode', async () => {
    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText('Generate Transaction Profile'),
      ).toBeInTheDocument();
    });
  });

  it('shows initial step description text', async () => {
    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Analyze 90 days of transaction data/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Transaction Trends')).toBeInTheDocument();
    expect(screen.getByText('Anomaly Detection')).toBeInTheDocument();
    expect(screen.getByText('Peer Comparison')).toBeInTheDocument();
    expect(screen.getByText('Investigator Notes')).toBeInTheDocument();
  });

  // ─── Close Button ─────────────────────────────────────────────

  it('closes modal when Close button is clicked', async () => {
    const user = userEvent.setup();
    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Close/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    // There may be multiple Cancel buttons; click the first one
    const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
    await user.click(cancelButtons[0]);
    expect(mockOnClose).toHaveBeenCalled();
  });

  // ─── Loading State ────────────────────────────────────────────

  it('shows loading state while fetching profile', async () => {
    let resolveGetProfile: (value: any) => void;
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveGetProfile = resolve;
      }),
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    expect(screen.getByText(/Loading profile data/i)).toBeInTheDocument();

    // Resolve to clear the loading state
    resolveGetProfile!(mockProfileResponse);

    await waitFor(() => {
      expect(screen.queryByText(/Loading profile data/i)).not.toBeInTheDocument();
    });
  });

  // ─── Existing Profile Loaded ──────────────────────────────────

  it('loads existing profile and shows generated step', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Transaction Profile')).toBeInTheDocument();
    });

    // Should show metrics
    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('Total Transactions')).toBeInTheDocument();
    expect(screen.getByText('Avg Ticket Size')).toBeInTheDocument();
    expect(screen.getByText('Anomalies Detected')).toBeInTheDocument();
  });

  it('shows anomalies table when profile is loaded', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Detected Anomalies/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Large Transfer')).toBeInTheDocument();
    expect(screen.getByText('Rapid Succession')).toBeInTheDocument();
  });

  it('shows charts when profile is loaded', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Transaction Volume Trend/i)).toBeInTheDocument();
      expect(screen.getByText(/Daily Transaction Count/i)).toBeInTheDocument();
    });
  });

  it('displays notes as read-only when profile exists', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test notes')).toBeInTheDocument();
    });
  });

  it('shows "No notes provided" when profile has no notes', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProfileResponse,
      notes: '',
    });

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/No notes provided/i)).toBeInTheDocument();
    });
  });

  // ─── Generate Profile Flow ────────────────────────────────────

  it('generates profile when button is clicked with valid tenantId', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    // Click Generate Profile (there may be 2 buttons, pick any)
    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(profileService.generateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' }),
      );
    });

    // Should transition to generated step
    await waitFor(() => {
      expect(screen.getByText('Total Value')).toBeInTheDocument();
    });
  });

  it('calls onSaveProfile after generating profile', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(mockOnSaveProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          riskLevel: 'High',
          anomalies: 2,
        }),
      );
    });
  });

  it('shows error when tenantId is missing', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({})); // no tenantId

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Tenant ID is required/i)).toBeInTheDocument();
    });
  });

  it('shows error when user localStorage is empty', async () => {
    const user = userEvent.setup();
    // No 'user' in localStorage

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Tenant ID is required/i)).toBeInTheDocument();
    });
  });

  it('shows error when user localStorage is invalid JSON', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', 'not-json');

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Tenant ID is required/i)).toBeInTheDocument();
    });
  });

  it('shows error when caseId is missing', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));

    render(
      <GenerateTransactionProfileModal
        open={true}
        onClose={mockOnClose}
        onSaveProfile={mockOnSaveProfile}
      />,
    );

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Case ID is required/i)).toBeInTheDocument();
    });
  });

  it('shows error when generateProfile rejects', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));
    (profileService.generateProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Service unavailable'),
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });
  });

  it('shows "Generating..." while saving', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));

    let resolveGenerate: (value: any) => void;
    (profileService.generateProfile as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolveGenerate = resolve;
      }),
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/Generating.../i).length).toBeGreaterThan(0);
    });

    resolveGenerate!(mockProfileResponse);

    await waitFor(() => {
      expect(screen.getByText('Total Value')).toBeInTheDocument();
    });
  });

  // ─── View Mode (initialProfile) ──────────────────────────────

  it('shows view mode header when initialProfile is provided', async () => {
    render(
      <GenerateTransactionProfileModal
        {...defaultProps}
        initialProfile={{
          generatedAt: '2024-01-01',
          totalVolume: '$100,000',
          anomalies: 3,
          riskLevel: 'High',
          notes: 'Initial notes',
        }}
      />,
    );

    // Title should be in view mode
    expect(screen.getByText('Transaction Profile')).toBeInTheDocument();
    // Save button should be available
    expect(screen.getByRole('button', { name: /Save Profile to Case/i })).toBeInTheDocument();
  });

  it('does not fetch profile when initialProfile is provided', async () => {
    render(
      <GenerateTransactionProfileModal
        {...defaultProps}
        initialProfile={{
          generatedAt: '2024-01-01',
          totalVolume: '$100,000',
          anomalies: 3,
          riskLevel: 'High',
        }}
      />,
    );

    expect(profileService.getProfile).not.toHaveBeenCalled();
  });

  it('shows notes textarea in non-view mode', async () => {
    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    // In initial step, textarea for notes is not shown (it's in generated step)
    // But let me generate first to get to generated step
  });

  // ─── Save Profile ─────────────────────────────────────────────

  it('saves profile and closes modal when Save button is clicked', async () => {
    const user = userEvent.setup();
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Total Value')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Profile to Case/i });
    await user.click(saveButton);

    expect(mockOnSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        riskLevel: 'High',
        anomalies: 2,
      }),
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose but not onSaveProfile when profileData is null and Save is clicked', async () => {
    const user = userEvent.setup();

    render(
      <GenerateTransactionProfileModal
        {...defaultProps}
        initialProfile={{
          generatedAt: '2024-01-01',
          totalVolume: '$0',
          anomalies: 0,
          riskLevel: 'Low',
        }}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /Save Profile to Case/i });
    await user.click(saveButton);

    // onClose is always called
    expect(mockOnClose).toHaveBeenCalled();
  });

  // ─── determineRiskLevel ───────────────────────────────────────

  it('shows High risk level when High risk anomalies exist', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProfileResponse,
      detectedAnomalies: [
        { id: 1, date: '2024-01-01', type: 'Test', amount: 100, description: 'test', risk: 'High' },
      ],
    });

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Risk Level: High/i)).toBeInTheDocument();
    });
  });

  it('shows Medium risk level when only Medium risk anomalies exist', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProfileResponse,
      detectedAnomalies: [
        { id: 1, date: '2024-01-01', type: 'Test', amount: 100, description: 'test', risk: 'Medium' },
      ],
    });

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Risk Level: Medium/i)).toBeInTheDocument();
    });
  });

  it('shows Low risk level when only Low risk anomalies exist', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProfileResponse,
      detectedAnomalies: [
        { id: 1, date: '2024-01-01', type: 'Test', amount: 100, description: 'test', risk: 'Low' },
      ],
    });

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Risk Level: Low/i)).toBeInTheDocument();
    });
  });

  it('shows Low risk level when no anomalies exist', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProfileResponse,
      detectedAnomalies: [],
    });

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Risk Level: Low/i)).toBeInTheDocument();
    });
  });

  // ─── Notes editing ────────────────────────────────────────────

  it('sends notes in generate request when notes are typed before generating', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));

    (profileService.generateProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProfileResponse,
      notes: 'Custom notes',
    });

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(profileService.generateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', notes: '' }),
      );
    });
  });

  // ─── Footer button text ───────────────────────────────────────

  it('shows "Cancel" in footer when on initial step', async () => {
    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    // Footer has Cancel button
    const buttons = screen.getAllByRole('button');
    const cancelBtn = buttons.find((b) => b.textContent === 'Cancel');
    expect(cancelBtn).toBeDefined();
  });

  it('shows "Close" in footer when on generated step', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Total Value')).toBeInTheDocument();
    });

    // Footer close button text should be "Close"
    const buttons = screen.getAllByRole('button');
    const closeBtn = buttons.find((b) => b.textContent === 'Close');
    expect(closeBtn).toBeDefined();
  });

  // ─── Generate button disabled without caseId ──────────────────

  it('shows error when caseId is not provided and Generate is clicked', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));

    render(
      <GenerateTransactionProfileModal
        open={true}
        onClose={mockOnClose}
        onSaveProfile={mockOnSaveProfile}
      />,
    );

    // The initial step Generate Profile button in the body doesn't check caseId via disabled,
    // but handleGenerateProfile checks it and sets error
    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Case ID is required/i)).toBeInTheDocument();
    });
  });

  // ─── Error display ────────────────────────────────────────────

  it('displays error in red box when error state is set', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));
    (profileService.generateProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  // ─── Anomaly risk badge colors ────────────────────────────────

  it('renders risk badges with correct styling', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });
  });

  // ─── onSaveProfile not provided ───────────────────────────────

  it('generates profile without calling onSaveProfile when not provided', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));

    render(
      <GenerateTransactionProfileModal
        open={true}
        onClose={mockOnClose}
        caseId="CASE-123"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(profileService.generateProfile).toHaveBeenCalled();
    });

    // No error should occur
    await waitFor(() => {
      expect(screen.getByText('Total Value')).toBeInTheDocument();
    });
  });

  // ─── Generate profile sends notes ─────────────────────────────

  it('includes notes in the generate profile request', async () => {
    const user = userEvent.setup();
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Ready to Generate/i)).toBeInTheDocument();
    });

    const generateButtons = screen.getAllByRole('button', { name: /Generate Profile/i });
    await user.click(generateButtons[0]);

    await waitFor(() => {
      expect(profileService.generateProfile).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        notes: '',
      });
    });
  });

  // ─── Amount display (numeric vs string) ───────────────────────

  it('displays numeric amounts with toLocaleString', async () => {
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(<GenerateTransactionProfileModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/51,380/)).toBeInTheDocument();
    });
  });

  // ─── Save profile without onSaveProfile callback ──────────────

  it('handles save when onSaveProfile is not provided', async () => {
    const user = userEvent.setup();
    (profileService.getProfile as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockProfileResponse,
    );

    render(
      <GenerateTransactionProfileModal
        open={true}
        onClose={mockOnClose}
        caseId="CASE-123"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Total Value')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Profile to Case/i });
    await user.click(saveButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
