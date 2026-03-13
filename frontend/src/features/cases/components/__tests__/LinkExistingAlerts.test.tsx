import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import LinkExistingAlerts from '../LinkExistingAlerts';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import triageService from '../../../alerts/services/triageservice';
import type { Alert } from '../../../alerts/types/triage.types';

// Mock triageService
vi.mock('../../../alerts/services/triageservice', () => ({
  default: {
    getNALTAlerts: vi.fn(),
  },
}));

const mockAlerts: any[] = [
  {
    alert_id: 'ALERT-001',
    alert_type: 'FRAUD',
    priority: 850,
    created_at: '2023-01-01T00:00:00Z',
    status: 'NALT',
    tenant_id: 'tenant-1',
    source: 'Source A',
    message: 'Test Alert 1',
    confidence_per: 90,
  },
  {
    alert_id: 'ALERT-002',
    alert_type: 'AML',
    priority: 500,
    created_at: '2023-01-02T00:00:00Z',
    status: 'NALT',
    tenant_id: 'tenant-1',
    source: 'Source B',
    message: 'Test Alert 2',
    confidence_per: 70,
  },
];

describe('LinkExistingAlerts', () => {
  const mockOnAlertsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: [],
      pagination: { currentPage: 1, totalPages: 0, totalItems: 0, pageSize: 10 },
    });
  });

  it('renders correctly when visible', () => {
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );
    expect(screen.getByText('Link Existing Alerts')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search by alert id/i),
    ).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(
      <LinkExistingAlerts
        isVisible={false}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );
    expect(screen.queryByText('Link Existing Alerts')).not.toBeInTheDocument();
  });

  it('loads and displays alerts', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 10 },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('ALERT-001')).toBeInTheDocument();
      expect(screen.getByText('ALERT-002')).toBeInTheDocument();
    });
  });

  it('allows selecting an alert', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 10 },
    });
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('ALERT-001'));

    // Find checkbox for first alert (first row)
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(mockOnAlertsChange).toHaveBeenCalledWith([mockAlerts[0]]);
  });

  it('allows deselecting a selected alert', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 10 },
    });
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0]]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('ALERT-001'));

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox corresponds to ALERT-001 which is already selected
    await user.click(checkboxes[0]);

    expect(mockOnAlertsChange).toHaveBeenCalledWith([]);
  });

  it('displays selected alerts count', async () => {
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0]]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    const countBadges = await screen.findAllByText(/1 alert selected/i);
    expect(countBadges.length).toBeGreaterThan(0);
  });

  it('shows empty state when no alerts available', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: [],
      pagination: { currentPage: 1, totalPages: 0, totalItems: 0, pageSize: 10 },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('No alerts found')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching alerts', async () => {
    (triageService.getNALTAlerts as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    // Wait for timeout debounce (300ms) then check loading
    await waitFor(() => {
      expect(screen.getByText('Loading alerts...')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('handles search term input and reloads alerts', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 10 },
    });
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/search by alert id/i);
    await user.type(searchInput, 'ALERT');

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalledWith(
        'ALERT',
        expect.any(Object),
      );
    });
  });

  it('shows pagination info when total items > 0', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 2, totalItems: 15, pageSize: 10 },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
    });
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it('shows pagination navigation when multiple pages', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 3, totalItems: 25, pageSize: 10 },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Next/i })).toBeInTheDocument();
    });
  });

  it('clear all button clears selected alerts', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 10 },
    });
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0]]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('ALERT-001'));

    const clearBtn = screen.getByRole('button', { name: /Clear all/i });
    await user.click(clearBtn);

    expect(mockOnAlertsChange).toHaveBeenCalledWith([]);
  });

  it('changes page size via the page size selector', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 10 },
    });
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('ALERT-001'));

    const pageSizeSelect = screen.getByRole('combobox');
    await user.selectOptions(pageSizeSelect, '20');

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ limit: 20, page: 1 }),
      );
    });
  });

  it('calls onAlertsSelected when prop is provided', async () => {
    const mockOnAlertsSelected = vi.fn();
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0]]}
        onAlertsChange={mockOnAlertsChange}
        onAlertsSelected={mockOnAlertsSelected}
      />,
    );

    await waitFor(() => {
      expect(mockOnAlertsSelected).toHaveBeenCalledWith(true);
    });
  });

  it('navigates to next page when Next button is clicked', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 3, totalItems: 25, pageSize: 10 },
    });
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('ALERT-001'));

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    await user.click(nextBtn);

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  it('shows ellipsis when totalPages exceeds window size', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: { currentPage: 1, totalPages: 10, totalItems: 100, pageSize: 10 },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('…')).toBeInTheDocument();
    });
  });
});
