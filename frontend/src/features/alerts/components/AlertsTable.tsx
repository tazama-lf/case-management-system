import React from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { TablePagination } from '@/shared';
import type {
  AlertsTableColumn,
  AlertsTableProps,
} from '../types/alertsdashboard.types';

const AlertsTable = <T extends Record<string, unknown>>({
  data,
  columns,
  actions,
  loading = false,
  emptyMessage = 'No data available',
  pagination,
  onSort,
  sortColumn,
  sortDirection,
  selectable = false,
  selectedRows = new Set(),
  onSelectionChange,
  rowKey = 'id' as keyof T,
  onRowClick,
}: AlertsTableProps<T>): React.ReactElement => {
  const getRowKey = (row: T, index: number): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(row);
    }
    const value = row[rowKey];
    return typeof value === 'string' || typeof value === 'number'
      ? value
      : index;
  };

  const handleSort = (column: keyof T | string): void => {
    if (!onSort) return;

    const newDirection =
      sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(column, newDirection);
  };

  const handleSelectAll = (checked: boolean): void => {
    if (!onSelectionChange) return;

    if (checked) {
      const allRowKeys = new Set(
        data.map((row, index) => getRowKey(row, index)),
      );
      onSelectionChange(allRowKeys);
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleRowSelect = (rowKey: string | number, checked: boolean): void => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedRows);
    if (checked) {
      newSelection.add(rowKey);
    } else {
      newSelection.delete(rowKey);
    }
    onSelectionChange(newSelection);
  };

  const isAllSelected = data.length > 0 && selectedRows.size === data.length;
  const isPartiallySelected =
    selectedRows.size > 0 && selectedRows.size < data.length;

  const renderCellContent = (
    column: AlertsTableColumn<T>,
    row: T,
  ): React.ReactNode => {
    if (column.render) {
      return column.render(row[column.key as keyof T], row);
    }
    const value = row[column.key as keyof T];
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return value;
    return String(value);
  };

  const getSortIcon = (column: AlertsTableColumn<T>): React.ReactElement | null => {
    if (!column.sortable || sortColumn !== column.key) {
      return null;
    }
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4" />
    ) : (
      <ChevronDownIcon className="h-4 w-4" />
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Loading...</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          {}
          <thead className="bg-gray-50">
            <tr>
              {}
              {selectable && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={(e) => {
                      handleSelectAll(e.target.checked);
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
              )}

              {}
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.align === 'center'
                      ? 'text-center'
                      : column.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                  } ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                  style={{ width: column.width }}
                  onClick={() => {
                    if (column.sortable) handleSort(column.key);
                  }}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {getSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {}
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)
                  }
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const key = getRowKey(row, index);
                const isSelected = selectedRows.has(key);

                return (
                  <tr
                    key={String(key)}
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {}
                    {selectable && (
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            handleRowSelect(key, e.target.checked);
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                    )}

                    {}
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${
                          column.align === 'center'
                            ? 'text-center'
                            : column.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                        }`}
                      >
                        {renderCellContent(column, row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && <TablePagination pagination={pagination} />}
    </div>
  );
};

export default AlertsTable;
