import React, { useState } from 'react';
import { useAuditLogs, useExportAuditLogs } from '../hooks/useAuditLogs';
import { auditLogService, type AuditLogFilters } from '../services/auditLogService';

interface AuditLogsPanelProps {
  className?: string;
}

const AuditLogsPanel: React.FC<AuditLogsPanelProps> = ({ className = '' }) => {
  const { data, isLoading, error, filters, updateFilters, resetFilters } = useAuditLogs();
  const { exportLogs, isExporting, exportError } = useExportAuditLogs();
  
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<Partial<AuditLogFilters>>({});

  const handleFilterChange = (field: keyof AuditLogFilters, value: string) => {
    setLocalFilters(prev => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const applyFilters = () => {
    updateFilters(localFilters);
    setShowFilters(false);
  };

  const handleExport = () => {
    exportLogs(filters);
  };

  const handlePageChange = (newPage: number) => {
    updateFilters({ page: newPage });
  };

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading audit logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} p-6`}>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading audit logs
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {error.message || 'Failed to load audit logs'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} p-6`}>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
            <p className="mt-1 text-gray-600">
              View system activity and compliance audit trails.
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="btn btn-primary disabled:opacity-50"
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

        {exportError && (
          <div className="mt-2 text-sm text-red-600">
            Export failed: {exportError}
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <input
                type="text"
                value={localFilters.userId || ''}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Filter by user ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <input
                type="text"
                value={localFilters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Filter by action"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resource
              </label>
              <input
                type="text"
                value={localFilters.resource || ''}
                onChange={(e) => handleFilterChange('resource', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Filter by resource"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Outcome
              </label>
              <select
                value={localFilters.outcome || ''}
                onChange={(e) => handleFilterChange('outcome', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All outcomes</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILURE">Failure</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex space-x-2">
            <button onClick={applyFilters} className="btn btn-primary">
              Apply Filters
            </button>
            <button onClick={resetFilters} className="btn btn-secondary">
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data?.logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{log.userId}</div>
                    {log.userEmail && (
                      <div className="text-gray-500">{log.userEmail}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {auditLogService.formatAction(log.action)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    <div className="font-medium">{log.resource}</div>
                    {log.resourceId && (
                      <div className="text-gray-500 text-xs">{log.resourceId}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${auditLogService.getOutcomeColorClass(log.outcome)}`}>
                    {auditLogService.formatOutcome(log.outcome)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data?.logs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No audit logs found matching the current filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((data.page - 1) * data.limit) + 1} to {Math.min(data.page * data.limit, data.total)} of {data.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(data.page - 1)}
              disabled={data.page <= 1}
              className="btn btn-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-gray-700">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(data.page + 1)}
              disabled={data.page >= data.totalPages}
              className="btn btn-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPanel;