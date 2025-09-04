import React from 'react';

// Transaction message interface
export interface TransactionMessage {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: 'sent' | 'received' | 'processing' | 'failed';
}

// Extended Alert interface for UI display
// We'll use intersection types to avoid conflicts
export interface Alert extends Record<string, unknown> {
  // Backend fields (matching TriageAlert)
  alert_id: string;
  tenant_id: string;
  priority: 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH';
  alert_type?: string | null;
  source?: string;
  txtp?: string;
  message: string;
  alert_data: unknown;
  transaction: unknown;
  network_map: unknown;
  confidence_per: number;
  created_at: string;
  case_id?: string;
}

// Search and filter interfaces
export interface AlertsSearchFilters {
  query: string;
  source: string;
  type: string; // Alert type filter
  priority: string; // Priority filter
  timeRange: string;
  startDate?: string;
  endDate?: string;
}

// Table column interface for alerts
export interface AlertsTableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

// Table action interface for alerts
export interface AlertsTableAction<T> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: T) => void;
  color?: 'blue' | 'green' | 'red' | 'gray';
  disabled?: (row: T) => boolean;
}

// Props interfaces for components
export interface AlertsTableProps<T> {
  data: T[];
  columns: AlertsTableColumn<T>[];
  actions?: AlertsTableAction<T>[];
  loading?: boolean;
  emptyMessage?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };
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
