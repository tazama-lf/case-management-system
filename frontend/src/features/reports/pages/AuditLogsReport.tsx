import React, { useState } from 'react';
import { ExclamationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import AuditLogsStatsCards from '../components/AuditLogsStatsCards';
import AuditLogsTable from '../components/AuditLogsTable';
import { useAuditLogs } from '../hooks/useReports';
import { exportToExcel, exportToCSV, exportToPDF, formatDataForExport, getColumnsForReport } from '../../../shared/utils/exportUtils';

interface AuditLogsReportProps {
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  dateRange: string;
}

const AuditLogsReport: React.FC<AuditLogsReportProps> = ({
  dateRange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('All Actions');
  const { data: auditData, isLoading, error } = useAuditLogs(dateRange);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
          ))}
        </div>
        <div className="bg-gray-200 h-96 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">Failed to load audit logs data. Please try again.</p>
        </div>
      </div>
    );
  }

  const { stats, auditLogs } = auditData || {
    stats: { totalLogs: 0, caseActions: 0, userSessions: 0, systemWarnings: 0 },
    auditLogs: []
  };

  const filteredLogs = auditLogs.filter(log => {
    const action = (log && log.action_performed) ? log.action_performed.toString() : '';
    const user = (log && log.user_id) ? log.user_id.toString() : '';
    const details = (log && log.outcome) ? log.outcome.toString() : '';

    const matchesSearch = searchTerm
      ? action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        details.toLowerCase().includes(searchTerm.toLowerCase())
      : true;

    const matchesAction = actionFilter === 'All Actions' || action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const handleExportExcel = () => {
    try {
      const formattedData = formatDataForExport(filteredLogs, 'AUDIT_LOGS');
      const filename = `audit-logs-report-${new Date().toISOString().split('T')[0]}`;
      exportToExcel(formattedData, filename, 'Audit Logs Report');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const formattedData = formatDataForExport(filteredLogs, 'AUDIT_LOGS');
      const filename = `audit-logs-report-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const formattedData = formatDataForExport(filteredLogs, 'AUDIT_LOGS');
      const filename = `audit-logs-report-${new Date().toISOString().split('T')[0]}`;
      const columns = getColumnsForReport('AUDIT_LOGS');
      await exportToPDF(formattedData, filename, 'Audit Logs Report', columns);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <>
      <AuditLogsStatsCards stats={stats} />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Audit Logs</h3>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="All Actions">All Actions</option>
            <option value="Permission changed">Permission changed</option>
            <option value="User logged in">User logged in</option>
            <option value="Report generated">Report generated</option>
            <option value="Task completed">Task completed</option>
            <option value="Task assigned">Task assigned</option>
            <option value="Case resumed">Case resumed</option>
            <option value="Case created">Case created</option>
            <option value="Case closed">Case closed</option>
            <option value="Case updated">Case updated</option>
          </select>
        </div>

        <AuditLogsTable
          data={filteredLogs}
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          isLoading={isLoading}
        />
      </div>
    </>
  );
};

export default AuditLogsReport;