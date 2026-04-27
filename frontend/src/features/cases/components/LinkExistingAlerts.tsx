import React, { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import triageService from '../../alerts/services/triageservice';
import type { Alert } from '../../alerts/types/triage.types';
import { formatDate } from '@/shared/utils/dateUtils';

interface LinkExistingAlertsTabProps {
  selectedAlerts: Alert[];
  onAlertsChange: (alerts: Alert[]) => void;
  isVisible: boolean;
  onAlertsSelected?: (hasAlerts: boolean) => void;
}

const LinkExistingAlertsTab: React.FC<LinkExistingAlertsTabProps> = ({
  selectedAlerts,
  onAlertsChange,
  isVisible,
  onAlertsSelected,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableAlerts, setAvailableAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    pageSize: 10,
  });

  useEffect(() => {
    if (onAlertsSelected) {
      onAlertsSelected(selectedAlerts.length > 0);
    }
  }, [selectedAlerts, onAlertsSelected]);

  useEffect(() => {
    if (!isVisible) return;

    const loadNALTAlerts = async () => {
      setIsLoading(true);
      try {
        const response = await triageService.getNALTAlerts(
          searchTerm || undefined,
          {
            page: 1, // Always start from page 1 when search term changes
            limit: pagination.pageSize,
            sortBy: 'created_at',
            sortOrder: 'desc',
          },
        );
        setAvailableAlerts(response.alerts);
        setPagination(response.pagination);
      } catch (error) {
        console.error('Failed to load NALT alerts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(loadNALTAlerts, 300);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isVisible, searchTerm, pagination.pageSize]);

  const handleAlertToggle = (alert: Alert) => {
    const isSelected = selectedAlerts.some(
      (a) => a.alert_id === alert.alert_id,
    );
    if (isSelected) {
      onAlertsChange(
        selectedAlerts.filter((a) => a.alert_id !== alert.alert_id),
      );
    } else {
      onAlertsChange([...selectedAlerts, alert]);
    }
  };

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPagination((prev) => ({ ...prev, currentPage: newPage }));
      loadAlertsWithPagination(newPage, pagination.pageSize);
    },
    [pagination.pageSize],
  );

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPagination((prev) => ({
      ...prev,
      pageSize: newPageSize,
      currentPage: 1,
    }));
    loadAlertsWithPagination(1, newPageSize);
  }, []);

  const loadAlertsWithPagination = useCallback(
    async (page: number, limit: number) => {
      setIsLoading(true);
      try {
        const response = await triageService.getNALTAlerts(
          searchTerm || undefined,
          {
            page,
            limit,
            sortBy: 'created_at',
            sortOrder: 'desc',
          },
        );
        setAvailableAlerts(response.alerts);
        setPagination(response.pagination);
      } catch (error) {
        console.error('Failed to load NALT alerts:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm],
  );

  const isAlertSelected = (alert: Alert) =>
    selectedAlerts.some((a) => a.alert_id === alert.alert_id);

  const filteredAlerts = React.useMemo(
    () => availableAlerts,
    [availableAlerts],
  );

  const getRiskScoreBadge = (score: number | string) => {
    const numScore = typeof score === 'string' ? parseInt(score, 10) : score;
    if (numScore >= 800) return 'bg-red-100 text-red-800';
    if (numScore >= 600) return 'bg-orange-100 text-orange-800';
    if (numScore >= 400) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'fraud':
        return 'bg-red-100 text-red-800';
      case 'aml':
        return 'bg-blue-100 text-blue-800';
      case 'fraud_and_aml':
      case 'fraud and aml':
        return 'bg-purple-100 text-purple-800';
      case 'suspicious':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="space-y-4">
      {}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Link Existing Alerts
          </h3>
          <p className="text-sm text-gray-500">
            Search and select NALT status alerts to link to this case
          </p>
        </div>
        {selectedAlerts.length > 0 && (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            {selectedAlerts.length} alert
            {selectedAlerts.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
          }}
          placeholder="Search by Alert ID, type, or description..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
        <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
      </div>

      {}
      {selectedAlerts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedAlerts.length} alert
              {selectedAlerts.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => {
                onAlertsChange([]);
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Clear all
            </button>
          </div>
          <div className="mt-1 text-xs text-blue-700">
            Selected alerts will be linked to this case
          </div>
        </div>
      )}

      {/* Page Size and Sorting Info */}
      {!isLoading && pagination.totalItems > 0 && (
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 ml-auto">
            <label className="text-sm text-gray-600">Show:</label>
            <select
              value={pagination.pageSize}
              onChange={(e) => {
                handlePageSizeChange(Number(e.target.value));
              }}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-600">per page</span>
          </div>

          <div className="text-sm text-gray-600">
            Sorted by Date Created (Descending)
          </div>
        </div>
      )}
      {}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alert ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    Loading alerts...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No alerts found
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={alert.alert_id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      isAlertSelected(alert) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      handleAlertToggle(alert);
                    }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isAlertSelected(alert)}
                        onChange={() => {
                          handleAlertToggle(alert);
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {alert.alert_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(
                          alert.txtp ?? alert.alert_type ?? 'Unknown',
                        )}`}
                      >
                        {alert.txtp ?? alert.alert_type ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRiskScoreBadge(
                          alert.priority ?? 0,
                        )}`}
                      >
                        {alert.priority ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {alert.created_at ? formatDate(alert.created_at) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls - Using same pattern as AlertsTable */}
        {!isLoading && pagination.totalItems > 0 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex flex-1 items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {Math.min(
                      (pagination.currentPage - 1) * pagination.pageSize + 1,
                      pagination.totalItems,
                    )}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(
                      pagination.currentPage * pagination.pageSize,
                      pagination.totalItems,
                    )}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium">{pagination.totalItems}</span>{' '}
                  results
                </p>
              </div>

              {/* Page Navigation - Always show if pagination exists */}
              {pagination.totalPages > 0 && (
                <div>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() => {
                        handlePageChange(
                          Math.max(1, pagination.currentPage - 1),
                        );
                      }}
                      disabled={pagination.currentPage <= 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    {/* Page Numbers with Ellipsis Logic */}
                    {(() => {
                      const { currentPage, totalPages } = pagination;
                      const pages: Array<number | 'ellipsis'> = [];
                      const windowSize = 5;
                      const half = Math.floor(windowSize / 2);

                      const addPage = (p: number) => pages.push(p);
                      const addEllipsis = () => pages.push('ellipsis');

                      if (totalPages <= windowSize + 2) {
                        for (let p = 1; p <= totalPages; p++) addPage(p);
                      } else {
                        const start = Math.max(2, currentPage - half);
                        const end = Math.min(
                          totalPages - 1,
                          currentPage + half,
                        );

                        addPage(1);
                        if (start > 2) addEllipsis();
                        for (let p = start; p <= end; p++) addPage(p);
                        if (end < totalPages - 1) addEllipsis();
                        addPage(totalPages);
                      }

                      return pages.map((p, idx) =>
                        p === 'ellipsis' ? (
                          <span
                            key={`ellipsis-${idx}`}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-400 select-none"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => {
                              handlePageChange(p);
                            }}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pagination.currentPage === p
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                            aria-current={
                              pagination.currentPage === p ? 'page' : undefined
                            }
                          >
                            {p}
                          </button>
                        ),
                      );
                    })()}

                    <button
                      onClick={() => {
                        handlePageChange(
                          Math.min(
                            pagination.totalPages,
                            pagination.currentPage + 1,
                          ),
                        );
                      }}
                      disabled={pagination.currentPage >= pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <div className="flex">
          <div className="ml-3">
            <div className="text-sm text-yellow-800">
              <strong>Note:</strong> Selected alerts will be linked to this
              case. You can manage linked alerts after case creation from the
              case details page.
              {selectedAlerts.length > 0 && (
                <p className="mt-1 font-medium">
                  The Create Case button is now enabled. Click it to create a
                  case with the first selected alert.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkExistingAlertsTab;
