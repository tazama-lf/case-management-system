import React from 'react';

// Alert data interface
export interface Alert extends Record<string, unknown> {
  id: string;
  transactionId: string;
  title: string;
  description: string;
  type: string; // Alert type
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  riskScore: number; // 0-100
  confidence: number; // 0-100 (confidence percentage)
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
  createdAt: string;
  updatedAt: string;
  lastUpdated: string; // Same as updatedAt but for display
  assignedTo?: string; // User ID of the assigned user
  assignee?: string; // Display name of assignee
  amount?: number;
  currency?: string;
}

// Search and filter interfaces
export interface AlertsSearchFilters {
  query: string;
  source: string;
  type: string; // Alert type filter
  priority: string; // Priority filter
  status: string; // Status filter
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
