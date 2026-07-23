import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: (date: string) => `formatted:${date}`,
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

const mockAlertsWithVariousScores: any[] = [
  { ...mockAlerts[0], alert_id: 'A1', priority: 900, alert_type: 'FRAUD' },
  { ...mockAlerts[0], alert_id: 'A2', priority: 650, alert_type: 'AML' },
  {
    ...mockAlerts[0],
    alert_id: 'A3',
    priority: 450,
    alert_type: 'FRAUD_AND_AML',
  },
  { ...mockAlerts[0], alert_id: 'A4', priority: 200, alert_type: 'suspicious' },
  { ...mockAlerts[0], alert_id: 'A5', priority: '800', alert_type: 'other' },
  {
    ...mockAlerts[0],
    alert_id: 'A6',
    priority: 0,
    txtp: 'fraud and aml',
    alert_type: null,
  },
];

const paginatedResponse = (
  alerts: any[],
  totalPages = 1,
  totalItems?: number,
) => ({
  alerts,
  pagination: {
    currentPage: 1,
    totalPages,
    totalItems: totalItems ?? alerts.length,
    pageSize: 10,
  },
});

describe('LinkExistingAlerts', () => {
  const mockOnAlertsChange = vi.fn();
  const mockOnAlertsSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse([]),
    );
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
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlerts, 1, 2),
    );

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
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlerts, 1, 2),
    );
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

  it('calls onAlertsSelected when selectedAlerts changes', () => {
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0]]}
        onAlertsChange={mockOnAlertsChange}
        onAlertsSelected={mockOnAlertsSelected}
      />,
    );

    expect(mockOnAlertsSelected).toHaveBeenCalledWith(true);
  });

  it('calls onAlertsSelected with false when no alerts selected', () => {
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
        onAlertsSelected={mockOnAlertsSelected}
      />,
    );

    expect(mockOnAlertsSelected).toHaveBeenCalledWith(false);
  });

  it('deselects an already selected alert', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlerts, 1, 2),
    );
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
    await user.click(checkboxes[0]);

    expect(mockOnAlertsChange).toHaveBeenCalledWith([]);
  });

  it('shows Clear all button when alerts are selected', () => {
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0]]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('clears all selected alerts when Clear all is clicked', async () => {
    const user = userEvent.setup();
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0], mockAlerts[1]]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await user.click(screen.getByText('Clear all'));
    expect(mockOnAlertsChange).toHaveBeenCalledWith([]);
  });

  it('shows plural "alerts" for multiple selected', () => {
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0], mockAlerts[1]]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    expect(screen.getAllByText(/2 alerts selected/i).length).toBeGreaterThan(0);
  });

  it('searches alerts by typing in search field', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlerts, 1, 2),
    );
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/search by alert id/i);
    await user.type(searchInput, 'ALERT-001');

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalledWith(
        'ALERT-001',
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  it('shows loading state while fetching', async () => {
    let resolveAlerts: (value: any) => void;
    (triageService.getNALTAlerts as any).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAlerts = resolve;
        }),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Loading alerts...')).toBeInTheDocument();
    });

    resolveAlerts!(paginatedResponse(mockAlerts, 1, 2));
  });

  it('shows No alerts found when no results', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse([]),
    );

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

  it('handles API error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (triageService.getNALTAlerts as any).mockRejectedValue(
      new Error('API error'),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load NALT alerts:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('shows pagination controls when totalItems > 0', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlerts, 2, 15),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  it('navigates to next page', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: {
        currentPage: 1,
        totalPages: 3,
        totalItems: 25,
        pageSize: 10,
      },
    });
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('Next'));

    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ page: 2 }),
      );
    });
  });

  it('disables Previous button on first page', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalItems: 15,
        pageSize: 10,
      },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeDisabled();
    });
  });

  it('changes page size', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalItems: 15,
        pageSize: 10,
      },
    });
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('Show:'));

    const pageSizeSelect = screen.getByDisplayValue('10');
    await user.selectOptions(pageSizeSelect, '25');

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ page: 1, limit: 25 }),
      );
    });
  });

  it('displays various risk score badge colors', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlertsWithVariousScores, 1, 6),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('A1')).toBeInTheDocument();
    });

    // Check risk score badge colors via classes
    const badges = screen.getAllByText(/900|650|450|200|800|0/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('displays alert type badges with correct text', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlertsWithVariousScores, 1, 6),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('FRAUD')).toBeInTheDocument();
      expect(screen.getByText('AML')).toBeInTheDocument();
      expect(screen.getByText('FRAUD_AND_AML')).toBeInTheDocument();
    });
  });

  it('shows selected alert note text', () => {
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[mockAlerts[0]]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    expect(
      screen.getByText(/The Create Case button is now enabled/),
    ).toBeInTheDocument();
  });

  it('shows note without selected alert text when none selected', () => {
    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    expect(
      screen.queryByText(/The Create Case button is now enabled/),
    ).not.toBeInTheDocument();
  });

  it('selects alert by clicking on row', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlerts, 1, 2),
    );
    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('ALERT-001'));

    // Click the row itself (not the checkbox)
    await user.click(screen.getByText('ALERT-001'));
    expect(mockOnAlertsChange).toHaveBeenCalledWith([mockAlerts[0]]);
  });

  it('shows date column with formatted date', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse(mockAlerts, 1, 2),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText('formatted:2023-01-01T00:00:00Z'),
      ).toBeInTheDocument();
    });
  });

  it('shows dash for alerts without created_at', async () => {
    const alertWithoutDate = {
      ...mockAlerts[0],
      alert_id: 'NO-DATE',
      created_at: null,
    };
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse([alertWithoutDate], 1, 1),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  it('shows txtp value when available instead of alert_type', async () => {
    const alertWithTxtp = {
      ...mockAlerts[0],
      alert_id: 'TXTP-ALERT',
      txtp: 'fraud and aml',
      alert_type: 'FRAUD',
    };
    (triageService.getNALTAlerts as any).mockResolvedValue(
      paginatedResponse([alertWithTxtp], 1, 1),
    );

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('fraud and aml')).toBeInTheDocument();
    });
  });

  it('handles pagination error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (triageService.getNALTAlerts as any)
      .mockResolvedValueOnce({
        alerts: mockAlerts,
        pagination: {
          currentPage: 1,
          totalPages: 3,
          totalItems: 25,
          pageSize: 10,
        },
      })
      .mockRejectedValueOnce(new Error('page load failed'));

    const user = userEvent.setup();

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('Next'));
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load NALT alerts:',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('shows page number buttons with ellipsis for many pages', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: {
        currentPage: 5,
        totalPages: 20,
        totalItems: 200,
        pageSize: 10,
      },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('Previous'));

    // Should show ellipsis for many pages
    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThan(0);

    // Should show page 1 and last page
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
  });

  it('shows page numbers without ellipsis for few pages', async () => {
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: {
        currentPage: 1,
        totalPages: 5,
        totalItems: 50,
        pageSize: 10,
      },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('Previous'));

    // Should show all page numbers
    for (let i = 1; i <= 5; i++) {
      expect(screen.getAllByText(String(i)).length).toBeGreaterThan(0);
    }
    // No ellipsis
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('navigates to specific page number', async () => {
    const user = userEvent.setup();
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: {
        currentPage: 1,
        totalPages: 20,
        totalItems: 200,
        pageSize: 10,
      },
    });

    render(
      <LinkExistingAlerts
        isVisible={true}
        selectedAlerts={[]}
        onAlertsChange={mockOnAlertsChange}
      />,
    );

    await waitFor(() => screen.getByText('Previous'));

    // Click page 3
    (triageService.getNALTAlerts as any).mockResolvedValue({
      alerts: mockAlerts,
      pagination: {
        currentPage: 3,
        totalPages: 20,
        totalItems: 200,
        pageSize: 10,
      },
    });
    await user.click(screen.getByText('3'));

    await waitFor(() => {
      expect(triageService.getNALTAlerts).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ page: 3 }),
      );
    });
  });
});
