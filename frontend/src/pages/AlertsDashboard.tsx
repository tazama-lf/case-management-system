import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ArrowDownTrayIcon, 
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { AlertsTable, AlertsSearchAndFilters } from '../components';
import AlertsDetailModal from '../components/common/AlertsDetailModal';
import TransactionMessagesModal from '../components/common/TransactionMessagesModal';
import MessagePayloadModal from '../components/common/MessagePayloadModal';
import type { Alert, AlertsSearchFilters, AlertsTableColumn, TransactionMessage } from '../types/alertsdashboard.types';
import type { ConvertToCaseData } from '../types/triage.types';
import triageService from '../services/triageservice';
import { transformBackendAlertToUI } from '../utils/alertTransformers';
import type { AlertsFilter, ConvertToCaseDto } from '../types/triage.types';

// API state management interfaces
interface ApiState {
  loading: boolean;
  error: string | null;
  alerts: Alert[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
  };
}

interface OperationStates {
  convertingToCase: Set<string>;
  closingAlert: Set<string>;
  updatingAlert: Set<string>;
  loadingDetails: Set<string>;
  submittingAlert: boolean;
}

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
  // API state management
  const [apiState, setApiState] = useState<ApiState>({
    loading: true,
    error: null,
    alerts: [],
    pagination: {
      currentPage: 1,
      totalPages: 0,
      totalItems: 0,
      pageSize: 10
    }
  });

  // State for tracking fetched source values (not used currently)
  
  // Operation states for loading indicators
  const [operationStates, setOperationStates] = useState<OperationStates>({
    convertingToCase: new Set(),
    closingAlert: new Set(),
    updatingAlert: new Set(),
    loadingDetails: new Set(),
    submittingAlert: false
  });
  
  const [searchFilters, setSearchFilters] = useState<AlertsSearchFilters>({
    query: '',
    source: '',
    type: '',
    priority: '',
    status: '',
    timeRange: '',
  });
  
  const [sortColumn, setSortColumn] = useState<keyof Alert | string>('lastUpdated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Field mapping utility: Maps frontend field names to backend field names
  const mapToBackendField = useCallback((frontendField: keyof Alert | string): string => {
    const fieldMapping: Record<string, string> = {
      // Date fields
      'createdAt': 'created_at',
      'updatedAt': 'created_at',
      'lastUpdated': 'created_at',
      'created_at': 'created_at',
      
      // Score/Confidence fields
      'riskScore': 'confidence_per',
      'confidence': 'confidence_per',
      'confidence_per': 'confidence_per',
      
      // Status and priority fields
      'priority': 'priority',
      'status': 'alert_status',
      'alert_status': 'alert_status',
      
      // ID fields
      'id': 'alert_id',
      'alert_id': 'alert_id',
      'transactionId': 'transaction_id',
      'txtp': 'txtp',
      
      // Other fields
      'source': 'source',
      'type': 'alert_type',
      'alert_type': 'alert_type'
    };
    
    const backendField = fieldMapping[frontendField as string];
    if (!backendField) {
      console.warn(`Unknown field mapping for: ${frontendField}, using as-is`);
      return frontendField as string;
    }
    
    return backendField;
  }, []);
  
  // Modal state for alert details
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Transaction modals state
  const [showTransactionMessages, setShowTransactionMessages] = useState(false);
  const [showMessagePayload, setShowMessagePayload] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<TransactionMessage | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string>('');
  
  // Custom date range state
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  // Debounced search query state
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // API integration functions
  const fetchAlerts = useCallback(async (filters: AlertsFilter = {}) => {
    try {
      setApiState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await triageService.getAlerts(filters);
      
      // Transform backend alerts to UI format
      const transformedAlerts = response.alerts.map(transformBackendAlertToUI);
      
      setApiState({
        loading: false,
        error: null,
        alerts: transformedAlerts,
        pagination: response.pagination
      });
      
      // Update last updated timestamp
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      let errorMessage = 'Failed to load alerts';
      
      if (error instanceof Error) {
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMessage = 'Access denied. You do not have permission to view alerts.';
        } else if (error.message.includes('Session expired')) {
          errorMessage = 'Session expired. Please log in again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setApiState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    const filters: AlertsFilter = {
      page: apiState.pagination.currentPage,
      limit: apiState.pagination.pageSize,
      sortBy: mapToBackendField(sortColumn),
      sortOrder: sortDirection
    };

    await fetchAlerts(filters);
  }, [fetchAlerts, apiState.pagination.currentPage, apiState.pagination.pageSize, sortColumn, sortDirection, mapToBackendField]);

  // Load alerts on component mount and when filters change
  // Load alerts on component mount and when pagination/sort change. Filters (search, type, priority, status)
  // are applied client-side in `filteredAndSortedAlerts` to avoid refetching on every filter interaction.
  useEffect(() => {
    const filters: AlertsFilter = {
      page: apiState.pagination.currentPage,
      limit: apiState.pagination.pageSize,
      sortBy: mapToBackendField(sortColumn),
      sortOrder: sortDirection
    };

    fetchAlerts(filters);
  }, [fetchAlerts, apiState.pagination.currentPage, apiState.pagination.pageSize, sortColumn, sortDirection, mapToBackendField]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchFilters.query);
      // Reset to first page when search query changes
      if (debouncedSearchQuery !== searchFilters.query) {
        setApiState(prev => ({
          ...prev,
          pagination: { ...prev.pagination, currentPage: 1 }
        }));
      }
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchFilters.query, debouncedSearchQuery]);

  // Real-time polling for dashboard updates
  useEffect(() => {
    const POLLING_INTERVAL = 30000; // Poll every 30 seconds
    
    const pollForUpdates = () => {
      // Only poll if not currently loading and not performing other operations
      const hasActiveOperations = operationStates.convertingToCase.size > 0 || 
                                  operationStates.closingAlert.size > 0 || 
                                  operationStates.updatingAlert.size > 0 ||
                                  operationStates.submittingAlert;
                                  
      if (!apiState.loading && !hasActiveOperations) {
        const filters: AlertsFilter = {
          priority: searchFilters.priority || undefined,
          status: searchFilters.status || undefined,
          type: searchFilters.type || undefined,
          search: debouncedSearchQuery || undefined, // Use debounced query
          page: apiState.pagination.currentPage,
          limit: apiState.pagination.pageSize,
          sortBy: mapToBackendField(sortColumn),
          sortOrder: sortDirection
        };

        // Silent refresh - don't show loading indicators
        fetchAlerts(filters);
      }
    };

    const intervalId = setInterval(pollForUpdates, POLLING_INTERVAL);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [fetchAlerts, searchFilters.priority, searchFilters.status, searchFilters.type, debouncedSearchQuery, apiState.pagination.currentPage, apiState.pagination.pageSize, sortColumn, sortDirection, mapToBackendField, apiState.loading, operationStates]);

  // Download Overturned Alerts Report
  const downloadOverturnedAlertsReport = () => {
    // Filter for overturned alerts (false positives)
    const overturnedAlerts = apiState.alerts.filter((alert: Alert) => alert.status === 'false_positive');
    
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

  // Filter and sort logic
  // Client-side filtering, sorting and pagination
  const filteredAndSortedAlerts = useMemo(() => {
    let filtered = apiState.alerts.slice();

    // Text query filter (search across alert id, message, transaction id)
    if (debouncedSearchQuery && debouncedSearchQuery.trim() !== '') {
      const q = debouncedSearchQuery.trim().toLowerCase();
      filtered = filtered.filter((a: Alert) => {
        const txId = (a.transactionId || '') as string;
        return (
          String(a.alert_id).toLowerCase().includes(q) ||
          String(a.message || '').toLowerCase().includes(q) ||
          txId.toLowerCase().includes(q)
        );
      });
    }

    // Source filter
    if (searchFilters.source) {
      filtered = filtered.filter(a => (a.source || '').toLowerCase() === searchFilters.source.toLowerCase());
    }

    // Type filter
    if (searchFilters.type) {
      filtered = filtered.filter(a => (a.alert_type || '').toLowerCase() === searchFilters.type.toLowerCase());
    }

    // Priority filter
    if (searchFilters.priority) {
      filtered = filtered.filter(a => (a.priority || '').toLowerCase() === searchFilters.priority.toLowerCase());
    }

    // Status filter
    if (searchFilters.status) {
      filtered = filtered.filter(a => (a.alert_status || '').toLowerCase() === searchFilters.status.toLowerCase());
    }

    // Time range filter
    if (searchFilters.timeRange) {
      filtered = filtered.filter((alert: Alert) => isDateInRange(alert.createdAt as string, searchFilters.timeRange, customDateRange));
    }

    // Sorting (client-side)
    const getValue = (item: Alert, key: string) => {
      const v = item[key as keyof Alert] as unknown;
      if (v === undefined || v === null) return '';
      if (typeof v === 'string') return v.toLowerCase();
      if (typeof v === 'number') return v;
      if (v instanceof Date) return v.getTime();
      return String(v);
    };

    filtered.sort((a: Alert, b: Alert) => {
      const aVal = getValue(a, sortColumn as string);
      const bVal = getValue(b, sortColumn as string);

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [apiState.alerts, debouncedSearchQuery, searchFilters.source, searchFilters.type, searchFilters.priority, searchFilters.status, searchFilters.timeRange, customDateRange, sortColumn, sortDirection]);

  // Apply client-side pagination to the filtered results
  const pageSize = apiState.pagination.pageSize;
  const currentPage = apiState.pagination.currentPage;
  const totalItems = filteredAndSortedAlerts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedAlerts = filteredAndSortedAlerts.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

  // Compute available alert types from fetched alerts for the filters UI
  const alertTypes = useMemo(() => {
    const set = new Set<string>();
    apiState.alerts.forEach((a) => {
      if (a.alert_type) set.add(a.alert_type);
    });
    return Array.from(set).sort();
  }, [apiState.alerts]);

  // Compute available priorities, statuses, and sources from fetched alerts
  const priorities = useMemo(() => {
    const set = new Set<string>();
    apiState.alerts.forEach((a) => {
      if (a.priority) set.add(String(a.priority));
    });
    return Array.from(set).sort();
  }, [apiState.alerts]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    apiState.alerts.forEach((a) => {
      if (a.alert_status) set.add(a.alert_status);
    });
    return Array.from(set).sort();
  }, [apiState.alerts]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    apiState.alerts.forEach((a) => {
      if (a.source) set.add(a.source);
    });
    return Array.from(set).sort();
  }, [apiState.alerts]);

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setApiState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, currentPage: page }
    }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setApiState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, pageSize: newPageSize, currentPage: 1 }
    }));
  };

  const handleSort = (column: keyof Alert | string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
    // Reset to first page when sorting changes
    setApiState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, currentPage: 1 }
    }));
  };

  const handleFilterChange = (key: keyof AlertsSearchFilters, value: string) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
    // Reset to first page when filters change
    setApiState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, currentPage: 1 }
    }));
  };

  const handleRowClick = async (alert: Alert) => {
    try {
      // Add to loading state
      setOperationStates(prev => ({ 
        ...prev, 
        loadingDetails: new Set([...prev.loadingDetails, alert.alert_id as string]) 
      }));

      // Fetch detailed alert data from API
      const detailedAlert = await triageService.getAlertById(alert.alert_id as string);
      
      // Transform backend data to UI format and show modal
      setSelectedAlert(transformBackendAlertToUI(detailedAlert));
      setShowModal(true);
      
    } catch (error) {
      console.error('Failed to fetch alert details:', error);
      
      // Fallback to showing the existing alert data
      setSelectedAlert(alert);
      setShowModal(true);
      
      // TODO: Show error toast notification
      // For now, just log the error
      console.warn('Using cached alert data due to API error');
      
    } finally {
      // Remove from loading state
      setOperationStates(prev => ({ 
        ...prev, 
        loadingDetails: new Set([...prev.loadingDetails].filter(id => id !== alert.alert_id)) 
      }));
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

  const handleConvertToCase = async (alert: Alert, caseData?: ConvertToCaseData) => {
    const alertId = alert.alert_id as string;
    
    try {
      // Set loading state
      setOperationStates(prev => ({
        ...prev,
        convertingToCase: new Set([...prev.convertingToCase, alertId])
      }));

      // Call API to convert alert to case
      if (caseData) {
        // Map UI priority values to backend priority values
        const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
          'low': 'LOW',
          'medium': 'MEDIUM', 
          'high': 'HIGH'
        };
        
        // Extract risk info from alert.alert_data.tadpResult.typologyResult[0] if present
        type LocalRiskComponent = { id: string; wght: number };
        let riskCategory: string | undefined;
        let riskScore: number | undefined;
        let riskComponents: LocalRiskComponent[] | undefined;

        const maybeTadp = alert.alert_data as unknown;
        let typology: Record<string, unknown> | undefined;
        if (maybeTadp && typeof maybeTadp === 'object') {
          const tadp = (maybeTadp as Record<string, unknown>)['tadpResult'];
          if (tadp && typeof tadp === 'object') {
            const typologyResult = (tadp as Record<string, unknown>)['typologyResult'];
            if (Array.isArray(typologyResult) && typologyResult.length > 0 && typeof typologyResult[0] === 'object') {
              typology = typologyResult[0] as Record<string, unknown>;
            }
          }
        }

        if (typology) {
          riskCategory = typology['id'] as string | undefined;
          const maybeResult = typology['result'];
          riskScore = typeof maybeResult === 'number' ? (maybeResult as number) : undefined;
          const maybeRules = typology['ruleResults'];
          if (Array.isArray(maybeRules)) {
            riskComponents = maybeRules.map((r) => {
              const rec = r as Record<string, unknown>;
              return { id: rec['id'] as string, wght: rec['wght'] as number };
            });
          }
        }

        const convertData: ConvertToCaseDto = {
          priority: priorityMap[caseData.priority as string] || 'MEDIUM',
          caseType: caseData.caseType as 'FRAUD' | 'AML' | 'FRAUD_AND_AML',
          // pass through optional case owner id when provided by modal
          caseOwnerUserId: caseData.caseOwnerUserId,
          riskCategory,
          riskScore,
          riskComponents,
        };
        
        await triageService.convertAlertToCase(alertId, convertData);
      } else {
        // Default conversion without case data
        const convertData: ConvertToCaseDto = {
          priority: alert.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          caseType: 'FRAUD' // Default case type
        };
        
        await triageService.convertAlertToCase(alertId, convertData);
      }

      // Refresh alerts to get updated data
      await refreshAlerts();

      handleCloseModal();
    } catch (error) {
      
      // Enhanced error handling
      let errorMessage = 'Failed to convert alert to case';
      if (error instanceof Error) {
        if (error.message.includes('403') || error.message.includes('permission')) {
          errorMessage = 'You do not have permission to convert this alert';
        } else if (error.message.includes('404')) {
          errorMessage = 'Alert not found';
        } else if (error.message.includes('already converted')) {
          errorMessage = 'This alert has already been converted to a case';
        } else {
          errorMessage = error.message;
        }
      }
      
      // TODO: Show error toast notification instead of console log
      console.error('Convert to case error:', errorMessage);
      throw error;
    } finally {
      // Remove loading state
      setOperationStates(prev => {
        const newSet = new Set(prev.convertingToCase);
        newSet.delete(alertId);
        return { ...prev, convertingToCase: newSet };
      });
    }
  };

  const handleCloseAlert = async (alert: Alert, justification?: string) => {
    const alertId = alert.alert_id as string;
    
    try {
      // Set loading state
      setOperationStates(prev => ({
        ...prev,
        closingAlert: new Set([...prev.closingAlert, alertId])
      }));

      // Call API to close alert
      await triageService.closeAlert(alertId, justification || 'Closed from dashboard');

      // Refresh alerts to get updated data
      await refreshAlerts();

      handleCloseModal();

    } catch (error) {
      console.error('Error closing alert:', error);
      
      // Enhanced error handling
      let errorMessage = 'Failed to close alert';
      if (error instanceof Error) {
        if (error.message.includes('403') || error.message.includes('permission')) {
          errorMessage = 'You do not have permission to close this alert';
        } else if (error.message.includes('404')) {
          errorMessage = 'Alert not found';
        } else if (error.message.includes('already closed')) {
          errorMessage = 'This alert is already closed';
        } else {
          errorMessage = error.message;
        }
      }
      
      // TODO: Show error toast notification instead of console log
      console.error('Close alert error:', errorMessage);
      throw error; // Re-throw to keep modal open
    } finally {
      setOperationStates(prev => {
        const newSet = new Set(prev.closingAlert);
        newSet.delete(alertId);
        return { ...prev, closingAlert: newSet };
      });
    }
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

  // Loading state render
  if (apiState.loading && apiState.alerts.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-full mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading alerts...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state render
  if (apiState.error && apiState.alerts.length === 0) {
    return (
      <div className="p-6">
        <div className="max-w-full mx-auto">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Error Loading Alerts</h3>
              <p className="mt-2 text-gray-600">{apiState.error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        {/* API Error Banner */}
        {apiState.error && apiState.alerts.length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error refreshing data
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{apiState.error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <AlertsSearchAndFilters
          searchFilters={searchFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
          customDateRange={customDateRange}
          onCustomDateRangeChange={setCustomDateRange}
          onSearch={(query) => {
            // Update search filters immediately for input field, debounce is handled separately
            setSearchFilters(prev => ({ ...prev, query }));
          }}
          alertTypes={alertTypes}
          priorities={priorities}
          statuses={statuses}
          sources={sources}
        />

        {/* Results Summary */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} alerts
            {apiState.loading && (
              <span className="ml-2">
                <div className="inline-block animate-spin h-4 w-4 border-2 border-gray-400 rounded-full border-t-transparent"></div>
              </span>
            )}
            {lastUpdated && !apiState.loading && (
              <span className="ml-4 text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="pageSize" className="text-sm text-gray-600">
                Show:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">per page</span>
            </div>
            <div className="text-sm text-gray-600">
              Sorted by {sortColumn} ({sortDirection === 'asc' ? 'ascending' : 'descending'})
            </div>
          </div>
        </div>

        {/* Alerts Table */}
        <div className="bg-white rounded-lg shadow">
          <AlertsTable
            data={paginatedAlerts}
            columns={columns}
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onRowClick={handleRowClick}
            emptyMessage="No alerts match your current filters. Try adjusting your search criteria."
            pagination={{
              currentPage,
              totalPages,
              pageSize,
              totalItems,
              onPageChange: handlePageChange,
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
        onAlertUpdated={() => fetchAlerts()} // Refresh alerts after updates
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
