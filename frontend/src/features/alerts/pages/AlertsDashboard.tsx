import React, { useState, Suspense, lazy } from 'react';
import { AlertsTable, AlertsSearchAndFilters } from '@/features/alerts/components';
import AlertsTableSkeleton from '@/features/alerts/components/AlertsTableSkeleton';
import ResultsSummary from '@/shared/components/ui/ResultsSummary';
import { PageContainer, Notification } from '@/shared/components/ui';
import ErrorFallback from '@/shared/components/ErrorFallback';
import { useSystemConfig } from '@/shared/hooks/useSystemConfig';
import { useToast } from '@/shared/providers/ToastProvider';
import type { Alert, AlertsTableColumn, TransactionMessage } from '@/features/alerts/types/alertsdashboard.types';
import type { ManualTriageDto } from '@/features/alerts/types/triage.types';
import triageService from '@/features/alerts/services/triageservice';
import { convertToTriageAlert, transformBackendAlertToUI } from '@/features/alerts/utils/alertTransformers';
import { extractTransactionIdFromAlert } from '@/features/alerts/utils/transactionUtils';
import { useAlerts } from '@/features/alerts/hooks/useAlerts';
import { useAlertFilterOptions, useAlertOperations } from '@/features/alerts/hooks/useAlertsQuery';

// Dynamic imports for modals
const AlertsDetailModal = lazy(() => import('@/features/alerts/components/AlertsDetailModal'));
const ManualTriageModal = lazy(() => import('@/features/alerts/components/ManualTriageModal'));
const TransactionMessagesModal = lazy(() => import('@/features/alerts/components/TransactionMessagesModal'));
const MessagePayloadModal = lazy(() => import('@/features/alerts/components/MessagePayloadModal'));

const AlertsDashboard: React.FC = () => {
  const { isAIMode, isManualMode, isDisabledMode } = useSystemConfig();

  const {
    paginatedAlerts: alerts,
    pagination,
    loading,
    error,
    filters,
    sort,
    lastUpdated,
    setFilters,
    setSort,
    setPage,
    setPageSize,
    refreshAlerts,
  } = useAlerts();

  const tablePagination = React.useMemo(() => ({
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    totalItems: pagination.totalItems,
    pageSize: pagination.pageSize,
    onPageChange: (p: number) => setPage(p),
  }), [pagination, setPage]);

  const { performManualTriage } = useAlertOperations();
  const { filterOptions } = useAlertFilterOptions();

  // Memoize filter options to prevent unnecessary re-renders
  const memoizedFilterOptions = React.useMemo(() => ({
    alertTypes: filterOptions.alertTypes,
    priorities: filterOptions.priorities,
    sources: filterOptions.sources,
  }), [filterOptions.alertTypes, filterOptions.priorities, filterOptions.sources]);

  // Memoize filter functions to prevent unnecessary re-renders
  const handleFilterChange = React.useCallback((key: keyof typeof filters, value: string) => {
    console.log('🔍 AlertsDashboard - Filter change:', key, '=', value);
    setFilters({ [key]: value });
    setPage(1);
  }, [setFilters, setPage]);

  const handleClearFilters = React.useCallback(() => {
    setFilters({
      query: '',
      source: '',
      type: '',
      priority: '',
      timeRange: '',
      customDateRange: undefined
    });
    setPage(1);
  }, [setFilters, setPage]);

  const handleCustomDateRangeChange = React.useCallback((range: { startDate: string; endDate: string }) => {
    setFilters({ customDateRange: range });
  }, [setFilters]);

  const handleToggleFilters = React.useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  const customDateRange = React.useMemo(() => 
    filters.customDateRange || { startDate: '', endDate: '' }
  , [filters.customDateRange]);
  const { success, error: showError } = useToast();

  const handleManualTriage = async (alert: Alert, triageData: ManualTriageDto) => {
    try {
      await performManualTriage({
        alertId: alert.alert_id,
        data: triageData,
      });
      success('Triage Complete', 'Alert triage completed successfully');

      // Refresh the alert details and keep the modal open
      try {
        const updatedAlert = await triageService.getAlertById(alert.alert_id);
        setSelectedAlert(transformBackendAlertToUI(updatedAlert));
        setShowManualTriageModal(false);
        setShowModal(true);
      } catch (error) {
        console.error('Failed to refresh alert:', error);
        refreshAlerts();
      }
    } catch (error) {
      console.error('Failed to perform manual triage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to perform triage. Please try again.';
      showError('Triage Failed', errorMessage);
      throw error;
    }
  };

  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showManualTriageModal, setShowManualTriageModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [showTransactionMessages, setShowTransactionMessages] = useState(false);
  const [showMessagePayload, setShowMessagePayload] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<TransactionMessage | null>(null);
  const [selectedAlertForTransaction, setSelectedAlertForTransaction] = useState<Alert | null>(null); const handleRowClick = async (alert: Alert) => {
    try {
      const detailedAlert = await triageService.getAlertById(alert.alert_id);
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

  const handleTransactionIdClick = (alert: Alert) => {
    setSelectedAlertForTransaction(alert);
    setShowTransactionMessages(true);
  };

  const handleTransactionMessageClick = (message: TransactionMessage) => {
    setSelectedMessage(message);
    setShowTransactionMessages(false);
    setShowMessagePayload(true);
  };

  const handleCloseTransactionMessages = () => {
    setShowTransactionMessages(false);
    setSelectedAlertForTransaction(null);
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

  const columns: AlertsTableColumn<Alert>[] = [
    {
      key: 'alert_id',
      header: 'Alert ID',
      sortable: true,
      render: (value) => {
        const alertId = value as string;
        return (
          <div
            className="font-medium text-gray-900"
            title={`Alert ID: ${alertId}`}
          >
            {alertId.length > 8 ? `${alertId.substring(0, 8)}...` : alertId}
          </div>
        );
      }
    },
    {
      key: 'txtp',
      header: 'Transaction ID',
      sortable: true,
      render: (_, alert) => {
        const transactionId = extractTransactionIdFromAlert(alert);

        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTransactionIdClick(alert);
            }}
            className="font-mono text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            title={`Transaction ID: ${transactionId}`}
          >
            {transactionId.length > 8 ? `${transactionId.substring(0, 8)}...` : transactionId}
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
      header: 'Date Created',
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

  // Show full page skeleton only on initial load with no data
  const isInitialLoad = loading && alerts.length === 0 && !lastUpdated;
  
  if (isInitialLoad) {
    return (
      <PageContainer
        title="Alerts Dashboard"
        subtitle={getSubtitle()}
      >
        <AlertsTableSkeleton rows={pagination.pageSize} />
      </PageContainer>
    );
  }

  if (error && alerts.length === 0) {
    return (
      <PageContainer
        title="Alerts Dashboard"
        subtitle={getSubtitle()}
      >
        <ErrorFallback
          error={error ? new Error(error) : undefined}
          resetError={() => refreshAlerts()}
          title="Failed to load alerts"
          showRetry={true}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Alerts Dashboard"
      subtitle={getSubtitle()}
    >
      { }
      {error && (
        <div className="mb-4">
          <Notification
            type="error"
            title="Error refreshing data"
            message={error || 'An error occurred while loading alerts'}
          />
        </div>
      )}

      { }
      <AlertsSearchAndFilters
        searchFilters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        customDateRange={customDateRange}
        onCustomDateRangeChange={handleCustomDateRangeChange}
        alertTypes={memoizedFilterOptions.alertTypes}
        priorities={memoizedFilterOptions.priorities}
        sources={memoizedFilterOptions.sources}
        showFilters={showFilters}
        onToggleFilters={handleToggleFilters}
      />

      <ResultsSummary
        pagination={tablePagination}
        loading={loading}
        lastUpdated={lastUpdated}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        sort={{ column: String(sort.column), direction: sort.direction }}
      />

      { }
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <AlertsTableSkeleton rows={pagination.pageSize} />
        ) : (
          <AlertsTable
            data={alerts}
            columns={columns}
            onSort={(column, direction) => {
              setSort(String(column), direction);
              setPage(1);
            }}
            sortColumn={sort.column}
            sortDirection={sort.direction}
            onRowClick={handleRowClick}
            emptyMessage="No alerts match your current filters. Try adjusting your search criteria."
            pagination={tablePagination}
          />
        )}
      </div>

      {/* Alerts Detail Modal */}
      <Suspense fallback={<div>Loading modal...</div>}>
        <AlertsDetailModal
          alertId={selectedAlert?.alert_id || null}
          isOpen={showModal}
          onClose={handleCloseModal}
          onAlertUpdated={refreshAlerts}
          onManualTriage={(alert: Alert) => {
            setSelectedAlert(alert);
            setShowModal(false);
            setShowManualTriageModal(true);
          }}
        />
      </Suspense>

      {/* Manual Triage Modal */}
      {selectedAlert && (
        <Suspense fallback={<div>Loading modal...</div>}>
          <ManualTriageModal
            isOpen={showManualTriageModal}
            alert={convertToTriageAlert(selectedAlert)}
            onClose={() => {
              setShowManualTriageModal(false);
              setSelectedAlert(null);
            }}
            onSubmit={(triageData: ManualTriageDto) => handleManualTriage(selectedAlert, triageData)}
          />
        </Suspense>
      )}

      {/* Transaction Messages Modal */}
      <Suspense fallback={<div>Loading modal...</div>}>
        <TransactionMessagesModal
          isOpen={showTransactionMessages}
          onClose={handleCloseTransactionMessages}
          alert={selectedAlertForTransaction}
          onMessageClick={handleTransactionMessageClick}
        />
      </Suspense>

      {/* Message Payload Modal */}
      <Suspense fallback={<div>Loading modal...</div>}>
        <MessagePayloadModal
          isOpen={showMessagePayload}
          onClose={handleCloseMessagePayload}
          message={selectedMessage}
          transactionData={selectedAlertForTransaction?.transaction}
        />
      </Suspense>
    </PageContainer>
  );
};

export default AlertsDashboard;