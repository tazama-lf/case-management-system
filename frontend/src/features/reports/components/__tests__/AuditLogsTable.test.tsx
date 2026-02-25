import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditLogsTable from '../AuditLogsTable';
import type { AuditLog } from '../../types/reports.types';

describe('AuditLogsTable', () => {
  const mockData: AuditLog[] = [
    {
      audit_log_id: 'LOG-1',
      user_id: 'user-1',
      operation: 'CREATE',
      entity_name: 'Case',
      action_performed: 'Created case',
      outcome: 'Success',
      performed_at: '2024-01-15T10:00:00Z',
      type: 'Success',
    },
    {
      audit_log_id: 'LOG-2',
      user_id: 'user-2',
      operation: 'UPDATE',
      entity_name: 'Alert',
      action_performed: 'Updated alert',
      outcome: 'Failed',
      performed_at: '2024-01-16T11:00:00Z',
      type: 'Error',
    },
    {
      audit_log_id: 'LOG-3',
      user_id: 'user-1',
      operation: 'DELETE',
      entity_name: 'Case',
      action_performed: 'Deleted case',
      outcome: 'Success',
      performed_at: '2024-01-17T12:00:00Z',
      type: 'Warning',
    },
  ];

  it('renders table with data', () => {
    render(<AuditLogsTable data={mockData} />);

    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    expect(screen.getByText('LOG-1')).toBeInTheDocument();
    expect(screen.getByText('LOG-2')).toBeInTheDocument();
    expect(screen.getByText('LOG-3')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<AuditLogsTable data={[]} isLoading={true} />);

    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<AuditLogsTable data={[]} />);

    expect(screen.getByText('No audit logs found')).toBeInTheDocument();
    expect(
      screen.getByText('Try adjusting your filters to see more results.'),
    ).toBeInTheDocument();
  });

  it('filters by outcome', async () => {
    const user = userEvent.setup();
    const { container } = render(<AuditLogsTable data={mockData} />);

    // Find select by finding all labels and getting the first one for Outcome
    const outcomeLabels = screen.getAllByText('Outcome');
    const outcomeLabel = outcomeLabels[0];
    const outcomeSelect = outcomeLabel.parentElement?.querySelector('select');
    expect(outcomeSelect).toBeInTheDocument();
    await user.selectOptions(outcomeSelect!, 'Success');

    await waitFor(() => {
      expect(screen.getByText('LOG-1')).toBeInTheDocument();
      expect(screen.queryByText('LOG-2')).not.toBeInTheDocument();
      expect(screen.getByText('LOG-3')).toBeInTheDocument();
    });
  });

  it('filters by entity', async () => {
    const user = userEvent.setup();
    render(<AuditLogsTable data={mockData} />);

    const entityLabels = screen.getAllByText('Entity');
    const entityLabel = entityLabels[0];
    const entitySelect = entityLabel.parentElement?.querySelector('select');
    expect(entitySelect).toBeInTheDocument();
    await user.selectOptions(entitySelect!, 'Case');

    await waitFor(() => {
      expect(screen.getByText('LOG-1')).toBeInTheDocument();
      expect(screen.queryByText('LOG-2')).not.toBeInTheDocument();
      expect(screen.getByText('LOG-3')).toBeInTheDocument();
    });
  });

  it('filters by type', async () => {
    const user = userEvent.setup();
    render(<AuditLogsTable data={mockData} />);

    const typeLabels = screen.getAllByText('Type');
    const typeLabel = typeLabels[0];
    const typeSelect = typeLabel.parentElement?.querySelector('select');
    expect(typeSelect).toBeInTheDocument();
    await user.selectOptions(typeSelect!, 'Error');

    await waitFor(() => {
      expect(screen.queryByText('LOG-1')).not.toBeInTheDocument();
      expect(screen.getByText('LOG-2')).toBeInTheDocument();
      expect(screen.queryByText('LOG-3')).not.toBeInTheDocument();
    });
  });

  it('applies multiple filters', async () => {
    const user = userEvent.setup();
    render(<AuditLogsTable data={mockData} />);

    const outcomeLabels = screen.getAllByText('Outcome');
    const outcomeLabel = outcomeLabels[0];
    const outcomeSelect = outcomeLabel.parentElement?.querySelector('select');
    const entityLabels = screen.getAllByText('Entity');
    const entityLabel = entityLabels[0];
    const entitySelect = entityLabel.parentElement?.querySelector('select');

    await user.selectOptions(outcomeSelect!, 'Success');
    await user.selectOptions(entitySelect!, 'Case');

    await waitFor(() => {
      expect(screen.getByText('LOG-1')).toBeInTheDocument();
      expect(screen.queryByText('LOG-2')).not.toBeInTheDocument();
      expect(screen.getByText('LOG-3')).toBeInTheDocument();
    });
  });

  it('changes items per page', async () => {
    const user = userEvent.setup();
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      ...mockData[0],
      audit_log_id: `LOG-${i + 1}`,
    }));

    render(<AuditLogsTable data={largeData} />);

    const itemsPerPageLabel = screen.getByText('Items per page');
    const itemsPerPageSelect =
      itemsPerPageLabel.parentElement?.querySelector('select');
    expect(itemsPerPageSelect).toBeInTheDocument();
    await user.selectOptions(itemsPerPageSelect!, '25');

    await waitFor(() => {
      expect(screen.getByText(/Showing.*of 25 entries/i)).toBeInTheDocument();
    });
  });

  it('handles pagination', async () => {
    const user = userEvent.setup();
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      ...mockData[0],
      audit_log_id: `LOG-${i + 1}`,
    }));

    render(<AuditLogsTable data={largeData} />);

    // Go to next page
    const nextButton = screen.getByRole('button', { name: /Next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('LOG-11')).toBeInTheDocument();
    });
  });

  it('disables previous button on first page', () => {
    const largeData = Array.from({ length: 15 }, (_, i) => ({
      ...mockData[0],
      audit_log_id: `LOG-${i + 1}`,
    }));

    render(<AuditLogsTable data={largeData} />);

    // Pagination only shows if totalPages > 1
    const previousButton = screen.queryByRole('button', { name: /Previous/i });
    if (previousButton) {
      expect(previousButton).toBeDisabled();
    } else {
      // If no pagination, that's also valid (only one page)
      expect(largeData.length).toBeLessThanOrEqual(10);
    }
  });

  it('disables next button on last page', async () => {
    const user = userEvent.setup();
    const largeData = Array.from({ length: 15 }, (_, i) => ({
      ...mockData[0],
      audit_log_id: `LOG-${i + 1}`,
    }));

    render(<AuditLogsTable data={largeData} />);

    // Go to last page (page 2)
    const page2Button = screen.getByRole('button', { name: '2' });
    await user.click(page2Button);

    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  it('calls onExportExcel when export button is clicked', async () => {
    const user = userEvent.setup();
    const onExportExcel = vi.fn();

    render(<AuditLogsTable data={mockData} onExportExcel={onExportExcel} />);

    const exportButton = screen.getByRole('button', {
      name: /Export as Excel/i,
    });
    await user.click(exportButton);

    expect(onExportExcel).toHaveBeenCalledTimes(1);
  });

  it('calls onExportCSV when export button is clicked', async () => {
    const user = userEvent.setup();
    const onExportCSV = vi.fn();

    render(<AuditLogsTable data={mockData} onExportCSV={onExportCSV} />);

    const exportButton = screen.getByRole('button', { name: /Export as CSV/i });
    await user.click(exportButton);

    expect(onExportCSV).toHaveBeenCalledTimes(1);
  });

  it('calls onExportPDF when export button is clicked', async () => {
    const user = userEvent.setup();
    const onExportPDF = vi.fn();

    render(<AuditLogsTable data={mockData} onExportPDF={onExportPDF} />);

    const exportButton = screen.getByRole('button', { name: /Export as PDF/i });
    await user.click(exportButton);

    expect(onExportPDF).toHaveBeenCalledTimes(1);
  });

  it('displays correct type colors', () => {
    render(<AuditLogsTable data={mockData} />);

    // Success appears in both option and badge, get the badge (span)
    const successBadges = screen.getAllByText('Success');
    const successBadge = successBadges.find((el) => el.tagName === 'SPAN');
    expect(successBadge).toHaveClass('bg-green-100', 'text-green-800');

    const errorBadges = screen.getAllByText('Error');
    const errorBadge = errorBadges.find((el) => el.tagName === 'SPAN');
    expect(errorBadge).toHaveClass('bg-red-100', 'text-red-800');

    const warningBadges = screen.getAllByText('Warning');
    const warningBadge = warningBadges.find((el) => el.tagName === 'SPAN');
    expect(warningBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('resets to page 1 when filter changes', async () => {
    const user = userEvent.setup();
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      ...mockData[0],
      audit_log_id: `LOG-${i + 1}`,
    }));

    render(<AuditLogsTable data={largeData} />);

    // Go to page 2
    const page2Button = screen.getByRole('button', { name: '2' });
    await user.click(page2Button);

    await waitFor(() => {
      expect(screen.getByText('LOG-11')).toBeInTheDocument();
    });

    // Change filter
    const outcomeLabels = screen.getAllByText('Outcome');
    const outcomeLabel = outcomeLabels[0];
    const outcomeSelect = outcomeLabel.parentElement?.querySelector('select');
    await user.selectOptions(outcomeSelect!, 'Success');

    // Should reset to page 1
    await waitFor(() => {
      expect(screen.getByText('LOG-1')).toBeInTheDocument();
    });
  });

  it('displays formatted dates', () => {
    render(<AuditLogsTable data={mockData} />);

    // Dates should be formatted - there will be multiple dates
    const dateTexts = screen.getAllByText(/2024/);
    expect(dateTexts.length).toBeGreaterThan(0);
  });

  it('handles missing optional fields', () => {
    const incompleteData: AuditLog[] = [
      {
        audit_log_id: '',
        user_id: '',
        operation: '',
        entity_name: '',
        action_performed: '',
        outcome: '',
        performed_at: '',
        type: 'Info',
      },
    ];

    render(<AuditLogsTable data={incompleteData} />);

    // Info appears in both the option and the badge
    const infoElements = screen.getAllByText('Info');
    expect(infoElements.length).toBeGreaterThan(0);
  });
});
