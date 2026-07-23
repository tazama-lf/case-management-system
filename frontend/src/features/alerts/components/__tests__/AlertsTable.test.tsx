import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsTable from '../AlertsTable';

type AlertRow = {
  id: string;
  status: string;
  priority: string;
};

const baseColumns = [
  { key: 'id', header: 'Alert ID', sortable: true },
  { key: 'status', header: 'Status', align: 'center' as const },
  { key: 'priority', header: 'Priority', align: 'right' as const },
];

const sampleData: AlertRow[] = [
  { id: 'ALERT-001', status: 'OPEN', priority: 'High' },
  { id: 'ALERT-002', status: 'CLOSED', priority: 'Low' },
];

describe('AlertsTable', () => {
  it('renders the empty state when no data is provided', () => {
    render(
      <AlertsTable<AlertRow>
        data={[]}
        columns={baseColumns}
        emptyMessage="No alerts"
      />,
    );

    expect(screen.getByText('No alerts')).toBeInTheDocument();
  });

  it('toggles sorting direction when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    const { rerender } = render(
      <AlertsTable<AlertRow>
        data={sampleData}
        columns={baseColumns}
        onSort={onSort}
        sortColumn="id"
        sortDirection="asc"
      />,
    );

    await user.click(screen.getByText('Alert ID'));
    expect(onSort).toHaveBeenCalledWith('id', 'desc');

    rerender(
      <AlertsTable<AlertRow>
        data={sampleData}
        columns={baseColumns}
        onSort={onSort}
        sortColumn="id"
        sortDirection="desc"
      />,
    );

    await user.click(screen.getByText('Alert ID'));
    expect(onSort).toHaveBeenLastCalledWith('id', 'asc');
  });

  it('supports row selection controls', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    render(
      <AlertsTable<AlertRow>
        data={sampleData}
        columns={baseColumns}
        selectable
        selectedRows={new Set()}
        onSelectionChange={onSelectionChange}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');

    await user.click(checkboxes[1]); // select first row
    let selection = onSelectionChange.mock.calls.at(-1)?.[0] as Set<string>;
    expect(Array.from(selection)).toEqual(['ALERT-001']);

    await user.click(checkboxes[0]); // select all
    selection = onSelectionChange.mock.calls.at(-1)?.[0] as Set<string>;
    expect(Array.from(selection)).toEqual(['ALERT-001', 'ALERT-002']);
  });

  it('fires row click handlers without being triggered by checkbox clicks', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();

    render(
      <AlertsTable<AlertRow>
        data={sampleData}
        columns={baseColumns}
        selectable
        selectedRows={new Set()}
        onSelectionChange={vi.fn()}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByText('ALERT-001'));
    expect(onRowClick).toHaveBeenCalledWith(sampleData[0]);

    const rowCheckbox = screen.getAllByRole('checkbox')[1];
    await user.click(rowCheckbox);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('renders pagination controls and invokes callbacks', async () => {
    const user = userEvent.setup();
    const pagination = {
      currentPage: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
      onPageChange: vi.fn(),
    };

    render(
      <AlertsTable<AlertRow>
        data={[sampleData[0]]}
        columns={baseColumns}
        pagination={pagination}
      />,
    );

    const summary = screen.getByText(/Showing/i);
    expect(summary.textContent?.replace(/\s+/g, ' ')).toContain(
      'Showing 1 to 1 of 2 results',
    );

    await user.click(screen.getByText('Next'));
    expect(pagination.onPageChange).toHaveBeenCalledWith(2);
  });
});
