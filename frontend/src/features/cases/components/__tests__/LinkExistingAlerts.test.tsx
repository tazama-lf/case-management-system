import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LinkExistingAlerts from '../LinkExistingAlerts';
import { vi, describe, it, expect } from 'vitest';
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
});
