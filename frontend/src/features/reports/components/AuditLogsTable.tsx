import React, { useState, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { AuditLog } from '../types/reports.types';

interface AuditLogsTableProps {
  data: AuditLog[];
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  isLoading?: boolean;
}

const AuditLogsTable: React.FC<AuditLogsTableProps> = ({ 
  data, 
  onExportExcel, 
  onExportCSV, 
  onExportPDF, 
  isLoading = false 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [entityFilter, setEntityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const filteredData = useMemo(() => {
    return data.filter(log => {
      const matchesOutcome = outcomeFilter === 'All' || log.outcome === outcomeFilter;
      const matchesEntity = entityFilter === 'All' || log.entity_name === entityFilter;
      const matchesType = typeFilter === 'All' || log.type === typeFilter;
      
      return matchesOutcome && matchesEntity && matchesType;
    });
  }, [data, outcomeFilter, entityFilter, typeFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const uniqueOutcomes = Array.from(new Set(data.map(log => log.outcome).filter(Boolean)));
  const uniqueEntities = Array.from(new Set(data.map(log => log.entity_name).filter(Boolean)));
  const uniqueTypes = Array.from(new Set(data.map(log => log.type).filter(Boolean)));

  React.useEffect(() => {
    setCurrentPage(1);
  }, [outcomeFilter, entityFilter, typeFilter]);

  const getTypeColor = (type: string) => {
    if (!type) return 'bg-blue-100 text-blue-800';

    switch (type) {
      case 'Success': return 'bg-green-100 text-green-800';
      case 'Warning': return 'bg-yellow-100 text-yellow-800';
      case 'Error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Audit Logs</h3>
          <div className="flex items-center gap-2">
            <div className="bg-gray-200 rounded w-24 h-8"></div>
            <div className="bg-gray-200 rounded w-24 h-8"></div>
            <div className="bg-gray-200 rounded w-24 h-8"></div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[...Array(7)].map((_, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="bg-gray-200 rounded w-16 h-4"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...Array(5)].map((_, rowIndex) => (
                <tr key={rowIndex} className="animate-pulse">
                  {[...Array(7)].map((_, colIndex) => (
                    <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                      <div className="bg-gray-200 rounded w-20 h-4"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Audit Logs</h3>
          <p className="text-sm text-gray-500 mt-1">
            Showing {paginatedData.length} of {filteredData.length} entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Export as Excel
            </button>
          )}
          {onExportCSV && (
            <button
              onClick={onExportCSV}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Export as CSV
            </button>
          )}
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Export as PDF
            </button>
          )}
        </div>
      </div>

      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Outcome</label>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="All">All Outcomes</option>
            {uniqueOutcomes.map(outcome => (
              <option key={outcome} value={outcome}>{outcome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Entity</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="All">All Entities</option>
            {uniqueEntities.map(entity => (
              <option key={entity} value={entity}>{entity}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="All">All Types</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Items per page</label>
          <select
            value={itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
      </div>

  
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <colgroup>
            <col className="w-72" />
            <col className="w-72" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-48" />
            <col className="w-32" />
            <col className="w-40" />
            <col className="w-20" />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Log ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Operation
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Outcome
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Performed At
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <svg className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg font-medium">No audit logs found</p>
                    <p className="text-sm">Try adjusting your filters to see more results.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((log, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-900 font-mono">
                    <div className="break-all" title={log.audit_log_id || ''}>
                      {log.audit_log_id || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-900 font-mono">
                    <div className="break-all" title={log.user_id || ''}>
                      {log.user_id || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">
                      {log.operation || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">
                      {log.entity_name || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">
                      {log.action_performed || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">
                      {log.outcome || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">
                      {formatDate(log.performed_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(log.type)}`}>
                      {log.type || 'Info'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-700">
            <span>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of{' '}
              {filteredData.length} results
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Previous
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 7) {
                  pageNumber = i + 1;
                } else if (currentPage <= 4) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNumber = totalPages - 6 + i;
                } else {
                  pageNumber = currentPage - 3 + i;
                }

                return (
                  <button
                    key={pageNumber}
                    onClick={() => handlePageChange(pageNumber)}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      currentPage === pageNumber
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsTable;