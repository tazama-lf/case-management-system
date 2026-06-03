import React, { useEffect } from 'react';
import type { CaseAgeingDetail } from '../types/reports.types';
import { usePagination } from '../../../shared/hooks/usePagination';
import TablePagination from '../../../shared/components/TablePagination';
import type { TablePaginationInfo } from '../../../shared/types/pagination.types';
import { useInvestigatorSupervisorList } from '@/features/cases/hooks/useInvestigatorSupervisorList';

interface CaseAgeingTableProps {
  data: CaseAgeingDetail[];
  title: string;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
}

const CaseAgeingTable: React.FC<CaseAgeingTableProps> = ({
  data,
  title,
  onExportExcel,
  onExportCSV,
  onExportPDF,
}) => {
  const {
    investigators,
    supervisors,
    fetchInvestigatorsList,
    fetchSupervisorsList,
    complianceOfficers,
    fetchComplianceOfficersList,
  } = useInvestigatorSupervisorList();

  const { currentPage, totalPages, paginatedData, setCurrentPage } =
    usePagination({
      data,
      defaultItemsPerPage: 5,
    });

  // Create pagination object for TablePagination
  const pagination: TablePaginationInfo = {
    currentPage,
    pageSize: 5, // Fixed page size since usePagination doesn't expose itemsPerPage in a way we need
    totalItems: data.length,
    totalPages,
    onPageChange: setCurrentPage,
  };

  const getAgeColor = (age: number) => {
    if (age <= 7) return 'text-green-600';
    if (age <= 15) return 'text-yellow-600';
    if (age <= 30) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  useEffect(() => {
    if (investigators.length === 0) {
      fetchInvestigatorsList();
    }
    if (supervisors.length === 0) {
      fetchSupervisorsList();
    }
    if (complianceOfficers.length === 0) {
      fetchComplianceOfficersList();
    }
  }, []);

  const getAssigneeFullName = (assigneeName?: string, assignee?: string) => {
    const compliance = complianceOfficers.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (compliance) return `${compliance.firstName} ${compliance.lastName}`;

    const inv = investigators.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (inv) return `${inv.firstName} ${inv.lastName}`;

    const sup = supervisors.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (sup) return `${sup.firstName} ${sup.lastName}`;

    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 pb-0">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
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
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Case ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Age (Days)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Investigator
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <p className="text-lg font-medium">No data available</p>
                    <p className="mt-1">
                      There are no case ageing records to display.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div
                      className="break-all font-mono text-sm"
                      title={String(row.caseId) || ''}
                    >
                      {row.caseId}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">{row.type}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">{row.status}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">{row.createdDate}</div>
                  </td>
                  <td
                    className={`px-4 py-3 text-sm font-medium ${getAgeColor(row.ageDays)}`}
                  >
                    {row.ageDays}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm font-medium ${getPriorityColor(row.priority)}`}
                  >
                    {row.priority}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="break-all font-mono text-sm"
                      title={
                        (row as any).userId ??
                        (row as any).user_id ??
                        (row as any).assigneeId ??
                        (row as any).assignee_id ??
                        ''
                      }
                    >
                      {(row as any).userId ??
                        (row as any).user_id ??
                        (row as any).assigneeId ??
                        (row as any).assignee_id ??
                        'N/A'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="break-words">
                      {getAssigneeFullName(row.investigator) || 'Unassigned'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        pagination={pagination}
        itemLabel="case ageing records"
      />
    </div>
  );
};

export default CaseAgeingTable;
