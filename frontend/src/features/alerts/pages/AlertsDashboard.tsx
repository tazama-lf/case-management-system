import React, { useState } from 'react';
import { AlertsTable, AlertsSearchAndFilters } from '../components';
import AlertsDetailModal from '../components/AlertsDetailModal';
import ManualTriageModal from '../components/ManualTriageModal';
import TransactionMessagesModal from '../components/TransactionMessagesModal';
import MessagePayloadModal from '../components/MessagePayloadModal';
import ResultsSummary from '../../../shared/components/ui/ResultsSummary';
import { PageContainer, LoadingState, Notification } from '../../../shared/components/ui';
import { useSystemConfig } from '../../../shared/hooks/useSystemConfig';

import type { Alert, AlertsTableColumn, TransactionMessage } from '../types/alertsdashboard.types';
import type { ManualTriageDto, Alert as TriageAlert, AlertType } from '../types/triage.types';
import triageService from '../services/triageservice';
import { transformBackendAlertToUI } from '../utils/alertTransformers';
import { useAlerts, useAlertFilterOptions, useAlertOperations } from '../hooks/useAlertsQuery';

const AlertsDashboard: React.FC = () => {
  const { isAIMode, isManualMode, isDisabledMode } = useSystemConfig();

  const [filters, setFilters] = useState({
    query: '',
    source: '',
    type: '',
    priority: '',
    timeRange: '',
    customDateRange: undefined as { startDate: string; endDate: string } | undefined
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState({ column: 'created_at', direction: 'desc' as 'asc' | 'desc' });

  const { alerts, pagination: serverPagination, isLoading, error, refetch } = useAlerts({
    search: filters.query,
    priority: filters.priority,
    type: filters.type,
    source: filters.source,
    sortBy: sort.column,
    sortOrder: sort.direction,
    page,
    limit: pageSize,
  });

  const tablePagination = React.useMemo(() => ({
    currentPage: serverPagination.currentPage,
    totalPages: serverPagination.totalPages,
    totalItems: serverPagination.totalItems,
    pageSize: serverPagination.pageSize,
    onPageChange: (p: number) => setPage(p),
  }), [serverPagination, setPage]);

  const { performManualTriage } = useAlertOperations();
  const { filterOptions } = useAlertFilterOptions();
  const loading = isLoading;
  const lastUpdated = new Date(); 

  const handleManualTriage = async (alert: Alert, triageData: ManualTriageDto) => {
    try {
      await performManualTriage({
        alertId: alert.alert_id as string,
        data: triageData,
      });
      refetch(); // Refresh the alerts list
    } catch (error) {
      console.error('Failed to perform manual triage:', error);
      throw error;
    }
  };

  // Modal state for alert details
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showManualTriageModal, setShowManualTriageModal] = useState(false);
  
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

  // Utility function to extract transaction ID from alert data
  const extractTransactionId = (alert: Alert): string => {
    try {
      const transaction = alert.transaction as any;
      if (transaction?.FIToFIPmtSts?.GrpHdr?.MsgId) {
        return transaction.FIToFIPmtSts.GrpHdr.MsgId;
      }
      // Fallback to txtp if MsgId not found
      return alert.txtp || 'Unknown';
    } catch {
      return alert.txtp || 'Unknown';
    }
  };

  // Utility function to convert Alert to TriageAlert for modal compatibility
  const convertToTriageAlert = (alert: Alert): TriageAlert => {
    return {
      ...alert,
      alert_type: (alert.alert_type as AlertType) || null, 
    };
  };

  // Transaction modal handlers
  const handleTransactionIdClick = (alert: Alert) => {
    const transactionId = extractTransactionId(alert);
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

  const getPriorityColor = (priority: string) => {
    if (!priority) return 'text-gray-600 bg-gray-50';
    switch (priority.toLowerCase()) {
      case 'breach': return 'text-red-600 bg-red-50';
      case 'critical': return 'text-orange-600 bg-orange-50';
      case 'urgent': return 'text-yellow-600 bg-yellow-50';
      case 'new': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Define table columns
  const columns: AlertsTableColumn<Alert>[] = [
    {
      key: 'alert_id',
      header: 'Alert ID',
      sortable: true,
      render: (value) => (
        <div className="font-medium text-gray-900">{value as string}</div>
      )
    },
    {
      key: 'txtp',
      header: 'Transaction ID',
      sortable: true,
      render: (_, alert) => {
        const transactionId = extractTransactionId(alert);
        
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTransactionIdClick(alert);
            }}
            className="font-mono text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            title={`Transaction ID: ${transactionId}`}
          >
            {transactionId.length > 12 ? `${transactionId.substring(0, 12)}...` : transactionId}
          </button>
        );
      }
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
        <span className="text-sm text-gray-600">{value === null ? 'NULL' : (value as string || 'N/A')}</span>
      )
    },
    {
      key: 'riskScore',
      header: 'Risk Score',
      sortable: true,
      render: (value) => {
        const score = value as number || 0;
        const getScoreColor = (score: number) => {
          if (score >= 80) return 'text-red-600 bg-red-50';
          if (score >= 60) return 'text-orange-600 bg-orange-50';
          if (score >= 40) return 'text-yellow-600 bg-yellow-50';
          if (score > 0) return 'text-green-600 bg-green-50';
          return 'text-gray-600 bg-gray-50';
        };
        
        return (
          <div className="flex items-center">
            <span className={`inline-flex px-2 py-1 text-sm font-bold rounded-full ${getScoreColor(score)}`}>
              {score}
            </span>
          </div>
        );
      }
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (value) => {
        const priority = value as string || 'Unknown';
        return (
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(priority)}`}>
            {priority.toUpperCase()}
          </span>
        );
      }
    },
    {
      key: 'confidence_per',
      header: 'Confidence %',
      sortable: true,
      render: (value) => (
        <div className="text-sm font-medium text-gray-900">{value as number}%</div>
      )
    },
    {
      key: 'created_at',
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

  // Get dynamic subtitle based on triage mode
  const getSubtitle = () => {
    if (isAIMode) {
      return "AI-automated triage with confidence-based routing and manual review for uncertain cases";
    } else if (isManualMode) {
      return "Manual triage and investigation - all alerts require human review";
    } else if (isDisabledMode) {
      return "Direct investigation mode - alerts bypass triage and go straight to cases";
    }
    return "Triage and investigate alerts, convert to cases, and manage alert workflows";
  };

  // Main loading and error states
  if (loading && alerts.length === 0) {
    return (
      <PageContainer
        title="Alerts Dashboard"
        subtitle={getSubtitle()}
      >
        <LoadingState loading={true}>
          <div />
        </LoadingState>
      </PageContainer>
    );
  }

  if (error && alerts.length === 0) {
    return (
      <PageContainer
        title="Alerts Dashboard"
        subtitle={getSubtitle()}
      >
        <LoadingState error={error?.message || 'An error occurred while loading alerts'}>
          <div />
        </LoadingState>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Alerts Dashboard"
      subtitle={getSubtitle()}
    >
        {/* API Error Banner */}
        {error && (
          <div className="mb-4">
            <Notification
              type="error"
              title="Error refreshing data"
              message={error?.message || 'An error occurred while loading alerts'}
            />
          </div>
        )}

        {/* Search and Filters */}
        <AlertsSearchAndFilters
          searchFilters={filters}
          onFilterChange={(key, value) => {
            setFilters(prev => ({ ...prev, [key]: value }));
            setPage(1); // Reset to first page when filters change
          }}
          onClearFilters={() => {
            setFilters({ 
              query: '',
              source: '',
              type: '',
              priority: '',
              timeRange: '',
              customDateRange: undefined
            });
            setPage(1); // Reset to first page when clearing filters
          }}
          customDateRange={filters.customDateRange || { startDate: '', endDate: '' }}
          onCustomDateRangeChange={(range) => setFilters(prev => ({ ...prev, customDateRange: range }))}
          alertTypes={filterOptions.alertTypes}
          priorities={filterOptions.priorities}
          sources={filterOptions.sources}
        />

        <ResultsSummary
          pagination={tablePagination}
          loading={loading}
          lastUpdated={lastUpdated}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1); // Reset to first page when page size changes
          }}
          sort={sort}
        />

        {/* Alerts Table */}
        <div className="bg-white rounded-lg shadow">
          <AlertsTable
            data={alerts}
            columns={columns}
            onSort={(column, direction) => { setSort({ column: String(column), direction }); setPage(1); }}
            sortColumn={sort.column}
            sortDirection={sort.direction}
            onRowClick={handleRowClick}
            emptyMessage="No alerts match your current filters. Try adjusting your search criteria."
            pagination={tablePagination}
          />
        </div>

      {/* Alert Detail Modal */}
      <AlertsDetailModal
        alertId={selectedAlert?.alert_id || null}
        isOpen={showModal}
        onClose={handleCloseModal}
        onAlertUpdated={refetch}
        onManualTriage={(alert: Alert) => {
          setSelectedAlert(alert);
          setShowModal(false);
          setShowManualTriageModal(true);
        }}
      />

      {/* Manual Triage Modal */}
      {selectedAlert && (
        <ManualTriageModal
          isOpen={showManualTriageModal}
          alert={convertToTriageAlert(selectedAlert)}
          onClose={() => {
            setShowManualTriageModal(false);
            setSelectedAlert(null);
          }}
          onSubmit={(triageData: ManualTriageDto) => handleManualTriage(selectedAlert, triageData)}
        />
      )}

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
    </PageContainer>
  );
};

export default AlertsDashboard;