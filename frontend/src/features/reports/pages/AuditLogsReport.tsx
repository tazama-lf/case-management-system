import React from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import AuditLogsStatsCards from '../components/AuditLogsStatsCards';
import AuditLogsTable from '../components/AuditLogsTable';
import { useAuditLogs } from '../hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../../../shared/utils/exportUtils';
import { useNotifications } from '@/shared/providers/NotificationProvider';

interface AuditLogsReportProps {
  dateRange: string;
}

const AuditLogsReport: React.FC<AuditLogsReportProps> = ({ dateRange }) => {
  const { data: auditData, isLoading, error } = useAuditLogs(dateRange);
  const { showError } = useNotifications();

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
          <p className="text-red-700">
            Failed to load audit logs data. Please try again.
          </p>
        </div>
      </div>
    );
  }

  const { stats, auditLogs } = auditData ?? {
    stats: { totalLogs: 0, caseActions: 0, userSessions: 0, systemWarnings: 0 },
    auditLogs: [],
  };

  const handleExportExcel = () => {
    try {
      const formattedData = formatDataForExport(auditLogs, 'AUDIT_LOGS');
      const filename = `audit-logs-report-${new Date().toISOString().split('T')[0]}`;
      exportToExcel(formattedData, filename, 'Audit Logs Report');
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const formattedData = formatDataForExport(auditLogs, 'AUDIT_LOGS');
      const filename = `audit-logs-report-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export failed. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const formattedData = formatDataForExport(auditLogs, 'AUDIT_LOGS');
      const filename = `audit-logs-report-${new Date().toISOString().split('T')[0]}`;
      const columns = getColumnsForReport('AUDIT_LOGS');
      await exportToPDF(formattedData, filename, 'Audit Logs Report', columns);
    } catch (error) {
      console.error('Export failed:', error);
      showError('Export failed. Please try again.');
    }
  };

  return (
    <>
      <AuditLogsStatsCards stats={stats} />

      <AuditLogsTable
        data={auditLogs}
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        isLoading={isLoading}
      />
    </>
  );
};

export default AuditLogsReport;
