import React from 'react';

export type { Alert, Priority, AlertType } from './triage.types';

export interface TransactionMessage {
  id: number;
  type: string;
  description: string;
  timestamp: string;
  status: 'sent' | 'received' | 'processing' | 'failed';
}

export interface AlertsSearchFilters {
  query: string;
  source: string;
  type: string;
  priority: string;
  timeRange: string;
  startDate?: string;
  endDate?: string;
}

import type { TablePaginationInfo } from '@/shared/types/pagination.types';

export interface AlertsTableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface AlertsTableAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: T) => void;
  color?: 'blue' | 'green' | 'red' | 'gray';
  disabled?: (row: T) => boolean;
}

export interface AlertsTableProps<T> {
  data: T[];
  columns: AlertsTableColumn<T>[];
  actions?: AlertsTableAction<T>[];
  loading?: boolean;
  emptyMessage?: string;
  pagination?: TablePaginationInfo;
  onSort?: (column: keyof T | string, direction: 'asc' | 'desc') => void;
  sortColumn?: keyof T | string;
  sortDirection?: 'asc' | 'desc';
  selectable?: boolean;
  selectedRows?: Set<string | number>;
  onSelectionChange?: (selectedRows: Set<string | number>) => void;
  rowKey?: keyof T | ((row: T) => string | number);
  onRowClick?: (row: T) => void;
}

export interface AlertsDashboardProps {
  onBack: () => void;
}
