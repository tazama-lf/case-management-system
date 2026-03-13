import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FindingsDetailsTable from '../FindingsDetailsTable';

const mockShowError = vi.fn();

vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: () => ({ showError: mockShowError }),
}));

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();

const mockData = [
  {
    caseId: 123,
    finding: 'Suspicious transaction pattern detected',
    conclusion: 'Confirmed',
    evidenceCount: 3,
    dateIdentified: '2024-01-15T10:00:00Z',
    supportingEvidence: ['transaction_log_1.pdf', 'transaction_log_2.pdf', 'transaction_log_3.pdf'],
  },
  {
    caseId: 456,
    finding: 'Unusual account activity',
    conclusion: 'Refuted',
    evidenceCount: 2,
    dateIdentified: '2024-01-16T11:00:00Z',
    supportingEvidence: ['account_log_1.pdf', 'account_log_2.pdf'],
  },
  {
    caseId: 789,
    finding: 'Inconclusive evidence',
    conclusion: 'Inconclusive',
    evidenceCount: 1,
    dateIdentified: '2024-02-01T10:00:00Z',
    supportingEvidence: ['report.pdf'],
  },
  {
    caseId: 999,
    finding: 'Unknown status finding',
    conclusion: 'Unknown',
    evidenceCount: 0,
    dateIdentified: '2024-03-01T10:00:00Z',
    supportingEvidence: [],
  },
];

describe('FindingsDetailsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
  });

  // ─── Rendering ────────────────────────────────────────────────

  it('renders table headers and data', () => {
    render(<FindingsDetailsTable data={mockData as any} />);
    expect(screen.getByText('Case ID')).toBeInTheDocument();
    expect(screen.getByText('Finding')).toBeInTheDocument();
    expect(screen.getByText('Conclusion')).toBeInTheDocument();
    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('Suspicious transaction pattern detected')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders loading skeletons', () => {
    const { container } = render(<FindingsDetailsTable data={[]} isLoading />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders empty state when data is empty', () => {
    render(<FindingsDetailsTable data={[]} />);
    expect(screen.getByText('No findings found')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<FindingsDetailsTable data={mockData as any} className="custom-cls" />);
    expect(container.querySelector('.custom-cls')).toBeInTheDocument();
  });

  // ─── Status badges ─────────────────────────────────────────

  it('displays correct badge colors for Confirmed', () => {
    render(<FindingsDetailsTable data={mockData as any} />);
    const badge = screen.getByText('Confirmed');
    expect(badge.className).toContain('bg-green-50');
  });

  it('displays correct badge colors for Refuted', () => {
    render(<FindingsDetailsTable data={mockData as any} />);
    const badge = screen.getByText('Refuted');
    expect(badge.className).toContain('bg-red-50');
  });

  it('displays correct badge colors for Inconclusive', () => {
    render(<FindingsDetailsTable data={mockData as any} />);
    const badge = screen.getByText('Inconclusive');
    expect(badge.className).toContain('bg-yellow-50');
  });

  it('displays default gray badge for unknown conclusion', () => {
    render(<FindingsDetailsTable data={mockData as any} />);
    const badge = screen.getByText('Unknown');
    expect(badge.className).toContain('bg-gray-50');
  });

  // ─── Expand / Collapse ──────────────────────────────────────

  it('expands a row to show supporting evidence', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData as any} />);

    await user.click(screen.getByText('123').closest('tr')!);
    await waitFor(() => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
      expect(screen.getByText('Full Finding Description')).toBeInTheDocument();
      expect(screen.getByText('transaction_log_1.pdf')).toBeInTheDocument();
    });
  });

  it('collapses a row when clicked again', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData as any} />);

    const row = screen.getByText('123').closest('tr')!;
    await user.click(row);
    await waitFor(() => expect(screen.getByText('Supporting Evidence')).toBeInTheDocument());

    await user.click(row);
    await waitFor(() => expect(screen.queryByText('Supporting Evidence')).not.toBeInTheDocument());
  });

  // ─── View evidence modal ────────────────────────────────────

  it('opens modal when view evidence button is clicked', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData as any} />);

    await user.click(screen.getByText('123').closest('tr')!);
    await waitFor(() => expect(screen.getByText('Supporting Evidence')).toBeInTheDocument());

    const viewBtns = screen.getAllByTitle('View evidence');
    await user.click(viewBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /transaction_log_1\.pdf/i })).toBeInTheDocument();
    });
  });

  it('closes modal via close button', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData as any} />);

    await user.click(screen.getByText('123').closest('tr')!);
    await waitFor(() => expect(screen.getByText('Supporting Evidence')).toBeInTheDocument());

    await user.click(screen.getAllByTitle('View evidence')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: /transaction_log_1\.pdf/i })).toBeInTheDocument());

    await user.click(screen.getByLabelText('Close modal'));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /transaction_log_1\.pdf/i })).not.toBeInTheDocument());
  });

  it('closes modal via backdrop click', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData as any} />);

    await user.click(screen.getByText('123').closest('tr')!);
    await waitFor(() => expect(screen.getByText('Supporting Evidence')).toBeInTheDocument());

    await user.click(screen.getAllByTitle('View evidence')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: /transaction_log_1\.pdf/i })).toBeInTheDocument());

    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
    if (backdrop) await user.click(backdrop);
    await waitFor(() => expect(screen.queryByRole('heading', { name: /transaction_log_1\.pdf/i })).not.toBeInTheDocument());
  });

  it('closes modal via footer Close button', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData as any} />);

    await user.click(screen.getByText('123').closest('tr')!);
    await waitFor(() => expect(screen.getByText('Supporting Evidence')).toBeInTheDocument());

    await user.click(screen.getAllByTitle('View evidence')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: /transaction_log_1\.pdf/i })).toBeInTheDocument());

    // Footer has a "Close" text button
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    const footerClose = closeButtons.find(b => b.textContent === 'Close');
    if (footerClose) await user.click(footerClose);
    await waitFor(() => expect(screen.queryByRole('heading', { name: /transaction_log_1\.pdf/i })).not.toBeInTheDocument());
  });

  // ─── Download ─────────────────────────────────────────────

  it('downloads evidence from expanded row', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData as any} />);

    await user.click(screen.getByText('123').closest('tr')!);
    await waitFor(() => expect(screen.getByText('Supporting Evidence')).toBeInTheDocument());

    await user.click(screen.getAllByTitle('Download evidence')[0]);
    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it('downloads evidence from modal footer', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData as any} />);

    await user.click(screen.getByText('123').closest('tr')!);
    await waitFor(() => expect(screen.getByText('Supporting Evidence')).toBeInTheDocument());

    await user.click(screen.getAllByTitle('View evidence')[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: /transaction_log_1\.pdf/i })).toBeInTheDocument());

    const downloadBtns = screen.getAllByRole('button', { name: /Download/i });
    await user.click(downloadBtns[downloadBtns.length - 1]);
    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());
  });

  it('shows error via showError when download fails', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.URL.createObjectURL = vi.fn(() => { throw new Error('fail'); });

    render(<FindingsDetailsTable data={mockData as any} />);

    await user.click(screen.getByText('123').closest('tr')!);
    await waitFor(() => expect(screen.getByText('Supporting Evidence')).toBeInTheDocument());

    await user.click(screen.getAllByTitle('Download evidence')[0]);
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('Failed to download document. Please try again.'));

    consoleSpy.mockRestore();
  });

  // ─── Date formatting ─────────────────────────────────────────

  it('displays formatted dates', () => {
    render(<FindingsDetailsTable data={mockData as any} />);
    const dates = screen.getAllByText(/15\/01\/2024|16\/01\/2024/);
    expect(dates.length).toBeGreaterThan(0);
  });
});
