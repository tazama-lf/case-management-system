import React, { useState, useMemo } from 'react';
import { 
  ArrowDownTrayIcon, 
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { AlertsTable, AlertsSearchAndFilters } from '../components';
import AlertsDetailModal from '../components/common/AlertsDetailModal';
import TransactionMessagesModal from '../components/common/TransactionMessagesModal';
import MessagePayloadModal from '../components/common/MessagePayloadModal';
import DashboardHeader from '../components/common/DashboardHeader';
import ResultsSummary from '../components/common/ResultsSummary';

import type { Alert, AlertsTableColumn, TransactionMessage } from '../types/alertsdashboard.types';
import triageService from '../services/triageservice';
import { transformBackendAlertToUI } from '../utils/alertTransformers';
import { useAlerts } from '../hooks/useAlerts';
import { useAlertOperations } from '../hooks/useAlertOperations';

const AlertsDashboard: React.FC = () => {
  const {
    paginatedAlerts,
    pagination,
    filters,
    sort,
    loading,
    error,
    lastUpdated,
    setFilters,
    setSort,
    setPage,
    setPageSize,
    refreshAlerts,
    allAlerts
  } = useAlerts();

  const { operationStates, handleConvertToCase, handleCloseAlert } = useAlertOperations(refreshAlerts);

  // Modal state for alert details
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Transaction modals state
  const [showTransactionMessages, setShowTransactionMessages] = useState(false);
  const [showMessagePayload, setShowMessagePayload] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<TransactionMessage | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>('');

  const handleRowClick = async (alert: Alert) => {
    try {
      const detailedAlert = await triageService.getAlertById(alert.alert_id as string);
      setSelectedAlert(transformBackendAlertToUI(detailedAlert));
      setShowModal(true);
    } catch (error) {
      console.error('Failed to fetch alert details:', error);
      setSelectedAlert(alert);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAlert(null);
  };

  // Transaction modal handlers
  const handleTransactionIdClick = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setShowTransactionMessages(true);
  };

  const handleTransactionMessageClick = (message: TransactionMessage) => {
    setSelectedMessage(message);
    setShowTransactionMessages(false);
    setShowMessagePayload(true);
  };

  const handleCloseTransactionMessages = () => {
    setShowTransactionMessages(false);
    setSelectedTransactionId('');
  };

  const handleCloseMessagePayload = () => {
    setShowMessagePayload(false);
    setSelectedMessage(null);
  };
  
  const downloadOverturnedAlertsReport = () => {
    // Filter for overturned alerts (false positives)
    const overturnedAlerts = allAlerts.filter((alert: Alert) => alert.status === 'false_positive');
    
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
    
    const csvData: string[][] = overturnedAlerts.map((alert: Alert) => [
      alert.alert_id as string || '',
      alert.transactionId as string || '',
      alert.source as string || '',
      (alert.riskScore as number || 0).toString(),
      alert.priority as string || '',
      (alert.confidence as number || 0).toString(),
      alert.status as string || '',
      new Date(alert.lastUpdated as string).toLocaleDateString(),
      alert.assignee as string || 'Unassigned',
      (alert.amount as number)?.toString() || 'N/A',
      alert.currency as string || 'N/A'
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map((row: string[]) => row.map((field: string) => `"${field}"`).join(','))
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

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'NEW':
        return 'text-blue-600 bg-blue-50';
      case 'AUTOCLOSED_CONFIRMED':
        return 'text-green-600 bg-green-50';
      case 'AUTOCLOSED_REFUTED':
        return 'text-red-600 bg-red-50';
      case 'CLOSED':
        return 'text-gray-600 bg-gray-50';
      case 'CONVERTED':
        return 'text-purple-600 bg-purple-50';
      case 'SENT_FOR_INVESTIGATION':
        return 'text-pink-600 bg-pink-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  // Define table columns
  const columns: AlertsTableColumn<Alert>[] = [
    {
      key: 'id',
      header: 'Alert ID',
      sortable: true,
      render: (value) => (
        <div className="font-medium text-gray-900">{value as string}</div>
      )
    },
    {
      key: 'transactionId',
      header: 'Transaction ID',
      sortable: true,
      render: (value) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTransactionIdClick(value as string);
          }}
          className="font-mono text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          {value as string}
        </button>
      )
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
    },
    {
      key: 'alert_type',
      header: 'Alert Type',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value as string}</span>
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
          {(value as string).replace(/_/g, ' ').toUpperCase()}
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

  if (loading && paginatedAlerts.length === 0) {
    return <div>Loading...</div>;
  }

  if (error && paginatedAlerts.length === 0) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="p-6">
      <div className="max-w-full mx-auto">
        <DashboardHeader onDownloadReport={downloadOverturnedAlertsReport} />

        {/* API Error Banner */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error refreshing data
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <AlertsSearchAndFilters
          searchFilters={filters}
          onFilterChange={(key, value) => setFilters({ [key]: value })}
          onClearFilters={() => setFilters({ query: '', source: '', type: '', priority: '', status: '', timeRange: '' })}
          customDateRange={filters.customDateRange}
          onCustomDateRangeChange={(range) => setFilters({ customDateRange: range })}
          alertTypes={[]}
          priorities={[]}
          statuses={[]}
          sources={[]}
        />

        <ResultsSummary
          pagination={pagination}
          loading={loading}
          lastUpdated={lastUpdated}
          onPageSizeChange={setPageSize}
          sort={sort}
        />

        {/* Alerts Table */}
        <div className="bg-white rounded-lg shadow">
          <AlertsTable
            data={paginatedAlerts}
            columns={columns}
            onSort={(column, direction) => setSort(column, direction)}
            sortColumn={sort.column}
            sortDirection={sort.direction}
            onRowClick={handleRowClick}
            emptyMessage="No alerts match your current filters. Try adjusting your search criteria."
            pagination={{
              ...pagination,
              onPageChange: setPage,
            }}
          />
        </div>
      </div>

      {/* Alert Detail Modal */}
      <AlertsDetailModal
        alertId={selectedAlert?.alert_id || null}
        isOpen={showModal}
        onClose={handleCloseModal}
        onConvertToCase={handleConvertToCase}
        onCloseAlert={handleCloseAlert}
        onAlertUpdated={refreshAlerts}
      />

      {/* Transaction Messages Modal */}
      <TransactionMessagesModal
        isOpen={showTransactionMessages}
        onClose={handleCloseTransactionMessages}
        transactionId={selectedTransactionId}
        onMessageClick={handleTransactionMessageClick}
      />

      {/* Message Payload Modal */}
      <MessagePayloadModal
        isOpen={showMessagePayload}
        onClose={handleCloseMessagePayload}
        message={selectedMessage}
      />
    </div>
  );
};

export default AlertsDashboard;