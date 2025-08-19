import React, { useState, useMemo } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  XMarkIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { AlertsTable } from '../components';
import type { Alert, AlertsSearchFilters, AlertsTableColumn, AlertsTableAction } from '../types/alertsdashboard.types';

// Mock data for demonstration
const mockAlerts: Alert[] = [
  {
    id: 'ALT-001',
    transactionId: 'TXN-12345',
    title: 'Suspicious Transaction Pattern',
    description: 'Multiple high-value transactions detected from same account',
    type: 'Transaction Monitoring',
    severity: 'high',
    priority: 'high',
    source: 'Transaction Monitoring System',
    riskScore: 85,
    confidence: 92,
    status: 'new',
    createdAt: '2025-08-19T10:30:00Z',
    updatedAt: '2025-08-19T10:30:00Z',
    lastUpdated: '2025-08-19T10:30:00Z',
    assignedTo: 'user-123',
    assignee: 'John Doe',
    amount: 150000,
    currency: 'USD'
  },
  {
    id: 'ALT-002',
    transactionId: 'TXN-12346',
    title: 'AML Risk Alert',
    description: 'Customer appears on sanctions list',
    type: 'AML Screening',
    severity: 'critical',
    priority: 'critical',
    source: 'AML Screening System',
    riskScore: 95,
    confidence: 98,
    status: 'investigating',
    createdAt: '2025-08-19T09:15:00Z',
    updatedAt: '2025-08-19T11:20:00Z',
    lastUpdated: '2025-08-19T11:20:00Z',
    assignedTo: 'user-123',
    assignee: 'John Doe',
    amount: 75000,
    currency: 'EUR'
  },
  {
    id: 'ALT-003',
    transactionId: 'TXN-12347',
    title: 'Unusual Payment Velocity',
    description: 'Rapid sequence of payments to different beneficiaries',
    type: 'Velocity Check',
    severity: 'medium',
    priority: 'medium',
    source: 'Real-time Monitoring',
    riskScore: 72,
    confidence: 85,
    status: 'new',
    createdAt: '2025-08-19T08:45:00Z',
    updatedAt: '2025-08-19T08:45:00Z',
    lastUpdated: '2025-08-19T08:45:00Z',
    assignedTo: 'user-123',
    assignee: 'John Doe',
    amount: 25000,
    currency: 'USD'
  },
  {
    id: 'ALT-004',
    transactionId: 'TXN-12348',
    title: 'Cross-border Transaction Alert',
    description: 'High-risk jurisdiction transaction detected',
    type: 'Geographic Risk',
    severity: 'high',
    priority: 'high',
    source: 'Geographic Screening',
    riskScore: 88,
    confidence: 90,
    status: 'resolved',
    createdAt: '2025-08-18T16:30:00Z',
    updatedAt: '2025-08-19T09:00:00Z',
    lastUpdated: '2025-08-19T09:00:00Z',
    assignedTo: 'user-123',
    assignee: 'John Doe',
    amount: 200000,
    currency: 'GBP'
  },
  {
    id: 'ALT-005',
    transactionId: 'TXN-12349',
    title: 'PEP Risk Alert',
    description: 'Transaction involving Politically Exposed Person',
    type: 'PEP Screening',
    severity: 'medium',
    priority: 'low',
    source: 'PEP Database',
    riskScore: 65,
    confidence: 78,
    status: 'false_positive',
    createdAt: '2025-08-18T14:20:00Z',
    updatedAt: '2025-08-19T10:15:00Z',
    lastUpdated: '2025-08-19T10:15:00Z',
    assignedTo: 'user-123',
    assignee: 'John Doe',
    amount: 50000,
    currency: 'USD'
  }
];

// Helper function to check if date is within time range
const isDateInRange = (dateString: string, timeRange: string, customDateRange?: { startDate: string; endDate: string }) => {
  const date = new Date(dateString);
  const now = new Date();
  
  switch (timeRange) {
    case 'today': {
      return date.toDateString() === now.toDateString();
    }
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return date.toDateString() === yesterday.toDateString();
    }
    case 'last7days': {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return date >= sevenDaysAgo;
    }
    case 'last30days': {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date >= thirtyDaysAgo;
    }
    case 'last90days': {
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return date >= ninetyDaysAgo;
    }
    case 'thisWeek': {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return date >= startOfWeek;
    }
    case 'thisMonth': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return date >= startOfMonth;
    }
    case 'custom': {
      if (customDateRange?.startDate && customDateRange?.endDate) {
        const startDate = new Date(customDateRange.startDate);
        const endDate = new Date(customDateRange.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        return date >= startDate && date <= endDate;
      }
      return true;
    }
    default:
      return true;
  }
};

const AlertsDashboard: React.FC = () => {
  const [searchFilters, setSearchFilters] = useState<AlertsSearchFilters>({
    query: '',
    source: '',
    type: '',
    priority: '',
    status: '',
    timeRange: '',
  });
  
  const [sortColumn, setSortColumn] = useState<keyof Alert | string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  
  // Custom date range state
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Download Overturned Alerts Report
  const downloadOverturnedAlertsReport = () => {
    // Filter for overturned alerts (false positives)
    const overturnedAlerts = mockAlerts.filter(alert => alert.status === 'false_positive');
    
    // Create CSV content
    const csvHeaders = [
      'Alert ID',
      'Transaction ID',
      'Source',
      'Risk Score',
      'Priority',
      'Confidence %',
      'Status',
      'Last Updated',
      'Assigned To',
      'Amount',
      'Currency'
    ];
    
    const csvData = overturnedAlerts.map(alert => [
      alert.id,
      alert.transactionId,
      alert.source,
      alert.riskScore.toString(),
      alert.priority,
      alert.confidence.toString(),
      alert.status,
      new Date(alert.lastUpdated).toLocaleDateString(),
      alert.assignee || 'Unassigned',
      alert.amount?.toString() || 'N/A',
      alert.currency || 'N/A'
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `overturned-alerts-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Filter and sort the alerts
  const filteredAndSortedAlerts = useMemo(() => {
    const filtered = mockAlerts.filter(alert => {
      const matchesQuery = !searchFilters.query || 
        alert.id.toLowerCase().includes(searchFilters.query.toLowerCase()) ||
        alert.title.toLowerCase().includes(searchFilters.query.toLowerCase()) ||
        alert.description.toLowerCase().includes(searchFilters.query.toLowerCase());
      
      const matchesType = !searchFilters.type || alert.type === searchFilters.type;
      const matchesPriority = !searchFilters.priority || alert.priority === searchFilters.priority;
      const matchesStatus = !searchFilters.status || alert.status === searchFilters.status;
      const matchesSource = !searchFilters.source || alert.source === searchFilters.source;
      const matchesTimeRange = !searchFilters.timeRange || isDateInRange(alert.createdAt, searchFilters.timeRange, customDateRange);

      return matchesQuery && matchesType && matchesPriority && matchesStatus && matchesSource && matchesTimeRange;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      const aValue = a[sortColumn as keyof Alert];
      const bValue = b[sortColumn as keyof Alert];
      
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [searchFilters, sortColumn, sortDirection, customDateRange]);

  const handleSort = (column: keyof Alert | string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  };

  const handleFilterChange = (key: keyof AlertsSearchFilters, value: string) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearchFilters({
      query: '',
      source: '',
      type: '',
      priority: '',
      status: '',
      timeRange: '',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-blue-600 bg-blue-50';
      case 'investigating': return 'text-yellow-600 bg-yellow-50';
      case 'resolved': return 'text-green-600 bg-green-50';
      case 'false_positive': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Define table columns
  const columns: AlertsTableColumn<Alert>[] = [
    {
      key: 'id',
      header: 'Alert ID',
      sortable: true,
      render: (value) => (
        <div className="font-medium text-blue-600">{value as string}</div>
      )
    },
    {
      key: 'transactionId',
      header: 'Transaction ID',
      sortable: true,
      render: (value) => (
        <div className="font-mono text-sm text-gray-900">{value as string}</div>
      )
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      render: (value) => (
        <div className="text-sm text-gray-600">{value as string}</div>
      )
    },
    {
      key: 'riskScore',
      header: 'Risk Score',
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          <span className={`font-medium ${(value as number) >= 80 ? 'text-red-600' : (value as number) >= 60 ? 'text-yellow-600' : 'text-green-600'}`}>
            {value as number}
          </span>
        </div>
      )
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(value as string)}`}>
          {(value as string).toUpperCase()}
        </span>
      )
    },
    {
      key: 'confidence',
      header: 'Confidence %',
      sortable: true,
      render: (value) => (
        <div className="text-sm font-medium text-gray-900">{value as number}%</div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(value as string)}`}>
          {(value as string).replace('_', ' ').toUpperCase()}
        </span>
      )
    },
    {
      key: 'lastUpdated',
      header: 'Last Updated',
      sortable: true,
      render: (value) => (
        <div className="text-sm text-gray-600">
          {new Date(value as string).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      )
    }
  ];

  // Define table actions
  const actions: AlertsTableAction<Alert>[] = [
    {
      label: 'Investigate',
      onClick: (alert) => {
        console.log('Investigate alert:', alert.id);
        // Navigate to alert details or investigation page
      },
      color: 'blue'
    },
    {
      label: 'Convert to Case',
      onClick: (alert) => {
        console.log('Convert to case:', alert.id);
        // Open case conversion modal
      },
      color: 'green',
      disabled: (alert) => alert.status === 'resolved' || alert.status === 'false_positive'
    }
  ];

  return (
    <div className="p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Alerts Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Triage and investigate alerts, convert to cases, and manage alert workflows
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={downloadOverturnedAlertsReport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Overturned Alerts Report
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by Alert ID, title, or keywords..."
                    value={searchFilters.query}
                    onChange={(e) => handleFilterChange('query', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FunnelIcon className="h-5 w-5 mr-2" />
                Filters
                {Object.values(searchFilters).some(value => value && value !== '') && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Active
                  </span>
                )}
              </button>

              {/* Clear Filters */}
              {Object.values(searchFilters).some(value => value && value !== '') && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <XMarkIcon className="h-5 w-5 mr-2" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alert Type
                  </label>
                  <select
                    value={searchFilters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="Transaction Monitoring">Transaction Monitoring</option>
                    <option value="AML Screening">AML Screening</option>
                    <option value="Velocity Check">Velocity Check</option>
                    <option value="Geographic Risk">Geographic Risk</option>
                    <option value="PEP Screening">PEP Screening</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={searchFilters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={searchFilters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="new">New</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="false_positive">False Positive</option>
                  </select>
                </div>

                {/* Source Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source
                  </label>
                  <select
                    value={searchFilters.source}
                    onChange={(e) => handleFilterChange('source', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Sources</option>
                    <option value="Transaction Monitoring System">Transaction Monitoring System</option>
                    <option value="AML Screening System">AML Screening System</option>
                    <option value="Real-time Monitoring">Real-time Monitoring</option>
                    <option value="Geographic Screening">Geographic Screening</option>
                    <option value="PEP Database">PEP Database</option>
                  </select>
                </div>

                {/* Time Range Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Range
                  </label>
                  <select
                    value={searchFilters.timeRange}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleFilterChange('timeRange', value);
                      if (value === 'custom') {
                        setShowCustomDatePicker(true);
                      } else {
                        setShowCustomDatePicker(false);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="thisWeek">This Week</option>
                    <option value="last7days">Last 7 Days</option>
                    <option value="thisMonth">This Month</option>
                    <option value="last30days">Last 30 Days</option>
                    <option value="last90days">Last 90 Days</option>
                    <option value="custom">Custom Range</option>
                  </select>
                </div>
              </div>

              {/* Custom Date Range Picker */}
              {showCustomDatePicker && searchFilters.timeRange === 'custom' && (
                <div className="mt-4 p-4 bg-white border border-gray-200 rounded-md">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Date Range</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customDateRange.startDate}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customDateRange.endDate}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {filteredAndSortedAlerts.length} of {mockAlerts.length} alerts
          </div>
          <div className="text-sm text-gray-600">
            Sorted by {sortColumn} ({sortDirection === 'asc' ? 'ascending' : 'descending'})
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-white rounded-lg shadow">
          <AlertsTable
            data={filteredAndSortedAlerts}
            columns={columns}
            actions={actions}
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            emptyMessage="No alerts match your current filters. Try adjusting your search criteria."
          />
        </div>
      </div>
    </div>
  );
};

export default AlertsDashboard;
