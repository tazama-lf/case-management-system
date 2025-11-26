import { describe, it, expect } from 'vitest';
import type {
  TransactionMessage,
  AlertsSearchFilters,
  AlertsTableColumn,
  AlertsTableAction,
  AlertsTableProps,
  AlertsDashboardProps,
} from '../alertsdashboard.types';

describe('Alerts Dashboard Types', () => {
  it('TransactionMessage should be assignable', () => {
    const message: TransactionMessage = {
      id: 'msg-1',
      type: 'request',
      description: 'Transaction request',
      timestamp: '2024-01-01T00:00:00Z',
      status: 'sent',
    };
    expect(message).toBeDefined();
    expect(message.id).toBe('msg-1');
    expect(message.status).toBe('sent');
  });

  it('AlertsSearchFilters should be assignable', () => {
    const filters: AlertsSearchFilters = {
      query: 'test',
      source: 'internal',
      type: 'FRAUD',
      priority: 'URGENT',
      timeRange: '7d',
      startDate: '2024-01-01',
      endDate: '2024-01-07',
    };
    expect(filters).toBeDefined();
    expect(filters.query).toBe('test');
    expect(filters.startDate).toBe('2024-01-01');
  });

  it('AlertsTableColumn should be assignable', () => {
    const column: AlertsTableColumn<{ id: string; name: string }> = {
      key: 'id',
      header: 'ID',
      sortable: true,
      width: '100px',
      align: 'left',
    };
    expect(column).toBeDefined();
    expect(column.key).toBe('id');
    expect(column.sortable).toBe(true);
  });

  it('AlertsTableColumn with render function should be assignable', () => {
    const column: AlertsTableColumn<{ id: string; name: string }> = {
      key: 'name',
      header: 'Name',
      render: (value, row) => `${value} (${row.id})`,
    };
    expect(column).toBeDefined();
    expect(column.render).toBeDefined();
    if (column.render) {
      const result = column.render('Test', { id: '1', name: 'Test' });
      expect(result).toBe('Test (1)');
    }
  });

  it('AlertsTableAction should be assignable', () => {
    const action: AlertsTableAction<{ id: string }> = {
      label: 'Edit',
      onClick: () => {},
      color: 'blue',
    };
    expect(action).toBeDefined();
    expect(action.label).toBe('Edit');
    expect(action.color).toBe('blue');
  });

  it('AlertsTableAction with disabled function should be assignable', () => {
    const action: AlertsTableAction<{ id: string; status: string }> = {
      label: 'Delete',
      onClick: () => {},
      color: 'red',
      disabled: (row) => row.status === 'locked',
    };
    expect(action).toBeDefined();
    expect(action.disabled).toBeDefined();
    if (action.disabled) {
      expect(action.disabled({ id: '1', status: 'locked' })).toBe(true);
      expect(action.disabled({ id: '2', status: 'active' })).toBe(false);
    }
  });

  it('AlertsTableProps should be assignable', () => {
    const props: AlertsTableProps<{ id: string; name: string }> = {
      data: [{ id: '1', name: 'Alert 1' }],
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' },
      ],
      loading: false,
      emptyMessage: 'No alerts found',
    };
    expect(props).toBeDefined();
    expect(props.data).toHaveLength(1);
    expect(props.columns).toHaveLength(2);
  });

  it('AlertsTableProps with pagination should be assignable', () => {
    const props: AlertsTableProps<{ id: string }> = {
      data: [{ id: '1' }],
      columns: [{ key: 'id', header: 'ID' }],
      pagination: {
        currentPage: 1,
        totalPages: 5,
        pageSize: 10,
        totalItems: 50,
        onPageChange: () => {},
      },
    };
    expect(props).toBeDefined();
    expect(props.pagination?.currentPage).toBe(1);
    expect(props.pagination?.totalPages).toBe(5);
  });

  it('AlertsTableProps with selection should be assignable', () => {
    const props: AlertsTableProps<{ id: string }> = {
      data: [{ id: '1' }, { id: '2' }],
      columns: [{ key: 'id', header: 'ID' }],
      selectable: true,
      selectedRows: new Set(['1']),
      onSelectionChange: () => {},
      rowKey: 'id',
    };
    expect(props).toBeDefined();
    expect(props.selectable).toBe(true);
    expect(props.selectedRows?.has('1')).toBe(true);
  });

  it('AlertsTableProps with sorting should be assignable', () => {
    const props: AlertsTableProps<{ id: string; name: string }> = {
      data: [{ id: '1', name: 'Alert 1' }],
      columns: [{ key: 'name', header: 'Name', sortable: true }],
      onSort: () => {},
      sortColumn: 'name',
      sortDirection: 'asc',
    };
    expect(props).toBeDefined();
    expect(props.sortColumn).toBe('name');
    expect(props.sortDirection).toBe('asc');
  });

  it('AlertsDashboardProps should be assignable', () => {
    const props: AlertsDashboardProps = {
      onBack: () => {},
    };
    expect(props).toBeDefined();
    expect(typeof props.onBack).toBe('function');
  });
});

