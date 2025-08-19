import React, { useState, useEffect } from 'react';
import { AlertsSearchWithFilters, AlertsTable, Navbar } from '../components';
import type { 
  Alert, 
  AlertsSearchFilters, 
  AlertsTableColumn,
  AlertsDashboardProps 
} from '../types/alertsdashboard.types';

const AlertsDashboard: React.FC<AlertsDashboardProps> = ({ onBack }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Sorting state - default to priority (critical first) then by timestamp
  const [sortColumn, setSortColumn] = useState<keyof Alert | string>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Handle navigation from navbar
  const handleNavigation = (href: string) => {
    if (href === '/' && onBack) {
      onBack(); // Navigate back to dashboard
    }
    // Add other navigation logic as needed
    console.log('Navigate to:', href);
  };

  // Handle logout from navbar
  const handleLogout = () => {
    console.log('Logout requested');
    // Handle logout logic here
  };

  // Mock data - replace with actual API call
  // Simulating alerts assigned to the logged-in user (John Doe)
  useEffect(() => {
    const currentUser = 'John Doe'; // This would come from auth context
    const mockAlerts: Alert[] = [
      {
        id: 'ALT-2024-001',
        transactionId: 'TXN-789456123',
        title: 'High-value transaction detected',
        description: 'Transaction exceeds daily limit threshold',
        type: 'High Value Transaction',
        severity: 'high',
        priority: 'high',
        source: 'Transaction Monitor',
        riskScore: 85,
        confidence: 92,
        status: 'new',
        createdAt: '2024-08-19T10:30:00Z',
        updatedAt: '2024-08-19T10:30:00Z',
        lastUpdated: '2024-08-19T10:30:00Z',
        assignedTo: 'john.doe',
        assignee: currentUser,
        amount: 50000,
        currency: 'USD'
      },
      {
        id: 'ALT-2024-002',
        transactionId: 'TXN-456789012',
        title: 'Suspicious pattern identified',
        description: 'Multiple transactions from same IP in short timeframe',
        type: 'Suspicious Pattern',
        severity: 'medium',
        priority: 'medium',
        source: 'Fraud Detection',
        riskScore: 72,
        confidence: 87,
        status: 'investigating',
        createdAt: '2024-08-19T09:15:00Z',
        updatedAt: '2024-08-19T11:20:00Z',
        lastUpdated: '2024-08-19T11:20:00Z',
        assignedTo: 'john.doe',
        assignee: currentUser,
        amount: 15000,
        currency: 'EUR'
      },
      {
        id: 'ALT-2024-003',
        transactionId: 'TXN-123456789',
        title: 'AML threshold exceeded',
        description: 'Customer cumulative transaction amount exceeds AML reporting threshold',
        type: 'AML Violation',
        severity: 'critical',
        priority: 'critical',
        source: 'AML Engine',
        riskScore: 95,
        confidence: 96,
        status: 'new',
        createdAt: '2024-08-19T08:45:00Z',
        updatedAt: '2024-08-19T08:45:00Z',
        lastUpdated: '2024-08-19T08:45:00Z',
        assignedTo: 'john.doe',
        assignee: currentUser,
        amount: 75000,
        currency: 'USD'
      },
      {
        id: 'ALT-2024-004',
        transactionId: 'TXN-987654321',
        title: 'KYC documentation missing',
        description: 'Customer profile missing required documentation',
        type: 'KYC Issue',
        severity: 'low',
        priority: 'low',
        source: 'KYC System',
        riskScore: 45,
        confidence: 78,
        status: 'resolved',
        createdAt: '2024-08-18T16:20:00Z',
        updatedAt: '2024-08-19T09:30:00Z',
        lastUpdated: '2024-08-19T09:30:00Z',
        assignedTo: 'john.doe',
        assignee: currentUser
      },
      {
        id: 'ALT-2024-005',
        transactionId: 'TXN-654321098',
        title: 'Unusual geographic activity',
        description: 'Transaction from unusual geographic location',
        type: 'Geographic Anomaly',
        severity: 'medium',
        priority: 'low',
        source: 'Fraud Detection',
        riskScore: 68,
        confidence: 74,
        status: 'false_positive',
        createdAt: '2024-08-18T14:10:00Z',
        updatedAt: '2024-08-19T08:15:00Z',
        lastUpdated: '2024-08-19T08:15:00Z',
        assignedTo: 'john.doe',
        assignee: currentUser,
        amount: 2500,
        currency: 'GBP'
      },
      {
        id: 'ALT-2024-006',
        transactionId: 'TXN-321098765',
        title: 'Velocity limit exceeded',
        description: 'Too many transactions in a short time period',
        type: 'Velocity Check',
        severity: 'high',
        priority: 'medium',
        source: 'Transaction Monitor',
        riskScore: 79,
        confidence: 88,
        status: 'investigating',
        createdAt: '2024-08-19T12:00:00Z',
        updatedAt: '2024-08-19T13:15:00Z',
        lastUpdated: '2024-08-19T13:15:00Z',
        assignedTo: 'john.doe',
        assignee: currentUser,
        amount: 25000,
        currency: 'USD'
      },
      {
        id: 'ALT-2024-007',
        transactionId: 'TXN-098765432',
        title: 'Blacklist match detected',
        description: 'Transaction involves entity on sanctions list',
        type: 'Sanctions Screening',
        severity: 'critical',
        priority: 'critical',
        source: 'Sanctions Monitor',
        riskScore: 98,
        confidence: 99,
        status: 'new',
        createdAt: '2024-08-19T14:30:00Z',
        updatedAt: '2024-08-19T14:30:00Z',
        lastUpdated: '2024-08-19T14:30:00Z',
        assignedTo: 'john.doe',
        assignee: currentUser,
        amount: 100000,
        currency: 'EUR'
      }
    ];

    // Simulate API loading
    setTimeout(() => {
      setAlerts(mockAlerts);
      setFilteredAlerts(mockAlerts);
      setLoading(false);
    }, 1000);
  }, []);

  // Handle search and filtering
  const handleSearch = (filters: AlertsSearchFilters) => {
    let filtered = [...alerts];

    // Text search (Alert ID, title, description, transaction ID)
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(alert => 
        alert.title.toLowerCase().includes(query) ||
        alert.description.toLowerCase().includes(query) ||
        alert.id.toLowerCase().includes(query) ||
        alert.transactionId.toLowerCase().includes(query)
      );
    }

    // Source filter
    if (filters.source && filters.source !== 'All Sources') {
      filtered = filtered.filter(alert => alert.source === filters.source);
    }

    // Type filter
    if (filters.type && filters.type !== 'All Types') {
      filtered = filtered.filter(alert => alert.type === filters.type);
    }

    // Priority filter
    if (filters.priority && filters.priority !== 'All Priorities') {
      filtered = filtered.filter(alert => alert.priority === filters.priority);
    }

    // Status filter
    if (filters.status && filters.status !== 'All Statuses') {
      filtered = filtered.filter(alert => alert.status === filters.status);
    }

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date();
      const alertDate = (alert: Alert) => new Date(alert.createdAt);

      switch (filters.timeRange) {
        case 'today': {
          filtered = filtered.filter(alert => {
            const created = alertDate(alert);
            return created.toDateString() === now.toDateString();
          });
          break;
        }
        case 'yesterday': {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          filtered = filtered.filter(alert => {
            const created = alertDate(alert);
            return created.toDateString() === yesterday.toDateString();
          });
          break;
        }
        case 'last7days': {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          filtered = filtered.filter(alert => alertDate(alert) >= sevenDaysAgo);
          break;
        }
        case 'last30days': {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          filtered = filtered.filter(alert => alertDate(alert) >= thirtyDaysAgo);
          break;
        }
        case 'custom': {
          if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            filtered = filtered.filter(alert => alertDate(alert) >= startDate);
          }
          if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(alert => alertDate(alert) <= endDate);
          }
          break;
        }
      }
    }

    setFilteredAlerts(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleClearSearch = () => {
    setFilteredAlerts(alerts);
    setCurrentPage(1);
  };

  // Handle sorting
  const handleSort = (column: keyof Alert | string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);

    const sorted = [...filteredAlerts].sort((a, b) => {
      // Special handling for priority and severity columns
      if (column === 'priority' || column === 'severity') {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aValue = priorityOrder[a[column as keyof Alert] as keyof typeof priorityOrder] || 0;
        const bValue = priorityOrder[b[column as keyof Alert] as keyof typeof priorityOrder] || 0;
        
        if (direction === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }

      // Regular sorting for other columns
      const aValue = a[column as keyof Alert];
      const bValue = b[column as keyof Alert];

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredAlerts(sorted);
  };

  // Severity badge component
  const SeverityBadge: React.FC<{ severity: Alert['severity'] }> = ({ severity }) => {
    const styles = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[severity]}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  // Priority badge component
  const PriorityBadge: React.FC<{ priority: Alert['priority'] }> = ({ priority }) => {
    const styles = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </span>
    );
  };

  // Status badge component
  const StatusBadge: React.FC<{ status: Alert['status'] }> = ({ status }) => {
    const styles = {
      new: 'bg-blue-100 text-blue-800',
      investigating: 'bg-yellow-100 text-yellow-800',
      resolved: 'bg-green-100 text-green-800',
      false_positive: 'bg-gray-100 text-gray-800'
    };

    const labels = {
      new: 'New',
      investigating: 'Investigating',
      resolved: 'Resolved',
      false_positive: 'False Positive'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // Format currency
  const formatCurrency = (amount: number | undefined, currency: string | undefined) => {
    if (!amount || !currency) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Table columns configuration - Alert ID, Transaction ID, Source, Risk Score, Priority, Confidence %, Status, Last Updated
  const columns: AlertsTableColumn<Alert>[] = [
    {
      key: 'id',
      header: 'Alert ID',
      sortable: true,
      width: '120px'
    },
    {
      key: 'transactionId',
      header: 'Transaction ID',
      sortable: true,
      width: '140px'
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      width: '140px'
    },
    {
      key: 'riskScore',
      header: 'Risk Score',
      sortable: true,
      align: 'center',
      width: '100px',
      render: (_, row) => (
        <div className="flex items-center justify-center">
          <span className={`text-sm font-medium ${
            row.riskScore >= 80 ? 'text-red-600' : 
            row.riskScore >= 60 ? 'text-orange-600' : 
            row.riskScore >= 40 ? 'text-yellow-600' : 'text-green-600'
          }`}>
            {row.riskScore}/100
          </span>
        </div>
      )
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      align: 'center',
      width: '100px',
      render: (_, row) => <PriorityBadge priority={row.priority} />
    },
    {
      key: 'confidence',
      header: 'Confidence %',
      sortable: true,
      align: 'center',
      width: '110px',
      render: (_, row) => (
        <span className="text-sm font-medium text-gray-900">
          {row.confidence}%
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      width: '120px',
      render: (_, row) => <StatusBadge status={row.status} />
    },
    {
      key: 'lastUpdated',
      header: 'Last Updated',
      sortable: true,
      width: '140px',
      render: (_, row) => formatDate(row.lastUpdated)
    }
  ];

  // Pagination
  const totalPages = Math.ceil(filteredAlerts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAlerts = filteredAlerts.slice(startIndex, startIndex + pageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar 
        onNavigate={handleNavigation}
        onLogout={handleLogout}
        user={{ name: 'John Doe', email: 'john.doe@tazama.org', initials: 'JD' }}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Alerts</h1>
          <p className="text-gray-600 mt-1">
            Alerts assigned to you for investigation and resolution. 
            Total: {filteredAlerts.length} alerts
          </p>
        </div>

        {/* Search and Filters */}
        <AlertsSearchWithFilters
          onSearch={handleSearch}
          onClear={handleClearSearch}
          placeholder="Search alerts by Alert ID, Transaction ID, title, or description..."
          sources={['All Sources', 'Transaction Monitor', 'AML Engine', 'KYC System', 'Fraud Detection', 'Sanctions Monitor']}
          types={['All Types', 'High Value Transaction', 'Suspicious Pattern', 'AML Violation', 'KYC Issue', 'Geographic Anomaly', 'Velocity Check', 'Sanctions Screening']}
          priorities={['All Priorities', 'low', 'medium', 'high', 'critical']}
          statuses={['All Statuses', 'new', 'investigating', 'resolved', 'false_positive']}
        />

        {/* Alerts Table */}
        <AlertsTable
          data={paginatedAlerts}
          columns={columns}
          loading={loading}
          emptyMessage="No alerts found matching your criteria"
          pagination={{
            currentPage,
            totalPages,
            pageSize,
            totalItems: filteredAlerts.length,
            onPageChange: setCurrentPage
          }}
          onSort={handleSort}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          rowKey="id"
        />
      </main>
    </div>
  );
};

export default AlertsDashboard;
