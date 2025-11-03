import React, { Suspense, lazy, useState } from 'react';
import { generateReportFilename } from '@/shared/utils/stringUtils';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { PageContainer } from '@/shared/components/ui';
import ReportStatsCards from '@/features/reports/components/ReportStatsCards';
import ReportFilters from '@/features/reports/components/ReportFilters';
import ReportsTable from '@/features/reports/components/ReportsTable';
import { useReports } from '@/features/reports/hooks/useReports';
import { exportToExcel, exportToCSV, exportToPDF, formatDataForExport, getColumnsForReport } from '@/shared/utils/exportUtils';
import { ReportsProcessor } from '@/features/reports/utils/reportsProcessor';

const PieChart = lazy(() => import('@/features/reports/components/PieChart'));
const BarChart = lazy(() => import('@/features/reports/components/BarChart'));
const MultiBarChart = lazy(() => import('@/features/reports/components/MultiBarChart'));


const InvestigatorWorkloadReport = lazy(() => import('./InvestigatorWorkloadReport'));
const TaskCompletionReport = lazy(() => import('./TaskCompletionReport'));
const AuditLogsReport = lazy(() => import('./AuditLogsReport'));
const CaseAgeingReport = lazy(() => import('./CaseAgeingReport'));

type ReportType = 'CASE_STATUS' | 'TASK_COMPLETION' | 'AUDIT_LOGS' | 'CASE_AGEING' | 'INVESTIGATOR_WORKLOAD';

const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('CASE_STATUS');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastYear'>('last30');
  const [filters, setFilters] = useState({ caseType: '', priority: '', investigator: '' });
  const { data: reportsData, isLoading, error } = useReports(dateRange, filters);

  const handleExportExcel = () => {
    try {
      const data = getCurrentReportData();
      const formattedData = formatDataForExport(data, reportType);
      const filename = generateReportFilename(reportType);
      exportToExcel(formattedData, filename, `${reportType} Report`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const data = getCurrentReportData();
      const formattedData = formatDataForExport(data, reportType);
      const filename = generateReportFilename(reportType);
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const data = getCurrentReportData();
      const formattedData = formatDataForExport(data, reportType);
      const filename = generateReportFilename(reportType);
      const columns = getColumnsForReport(reportType);
      const title = getPageTitle();
      await exportToPDF(formattedData, filename, title, columns);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleApplyFilters = (newFilters: { caseType: string; priority: string; investigator: string }) => {
    setFilters(newFilters);
  };

  const getCurrentReportData = () => {
    switch (reportType) {
      case 'CASE_STATUS':
        return statusDetails;
      case 'TASK_COMPLETION':
        return [];
      case 'AUDIT_LOGS':
        return [];
      case 'CASE_AGEING':
        return [];
      case 'INVESTIGATOR_WORKLOAD':
        return [];
      default:
        return [];
    }
  };


  if (isLoading) {
    return (
      <PageContainer
        title="Reports Dashboard"
        subtitle="Overview of cases by status, type, and outcome"
      >
        <div className="animate-pulse">
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-200 h-64 rounded-lg"></div>
            <div className="bg-gray-200 h-64 rounded-lg"></div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer
        title="Reports Dashboard"
        subtitle="Overview of cases by status, type, and outcome"
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">Failed to load reports data. Please try again.</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const { stats, statusDistribution, caseTypes, outcomes, monthlyTrend, statusDetails } = reportsData || 
    ReportsProcessor.createFallbackData();

  const statusDistributionData = ReportsProcessor.processStatusDistributionData(statusDistribution, stats.totalCases);

  const outcomeData = ReportsProcessor.processOutcomeData(outcomes);

  const getPageTitle = () => {
    switch (reportType) {
      case 'CASE_STATUS': return 'Case Status Report';
      case 'TASK_COMPLETION': return 'Task Completion Report';
      case 'AUDIT_LOGS': return 'Audit Logs';
      case 'CASE_AGEING': return 'Case Ageing Report';
      case 'INVESTIGATOR_WORKLOAD': return 'Investigator Workload Report';
      default: return 'Reports Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (reportType) {
      case 'CASE_STATUS': return 'Overview of cases by status, type, and outcome';
      case 'TASK_COMPLETION': return 'Analysis of task completion rates and time to completion';
      case 'AUDIT_LOGS': return 'Detailed log of all system activities for compliance and audit purposes';
      case 'CASE_AGEING': return 'Analysis of case duration from creation to closure';
      case 'INVESTIGATOR_WORKLOAD': return 'Overview of investigator workloads and performance metrics';
      default: return 'Overview of cases by status, type, and outcome';
    }
  };

  return (
    <PageContainer
      title={getPageTitle()}
      subtitle={getPageSubtitle()}
    >
      <ReportFilters
        reportType={reportType}
        dateRange={dateRange}
        onChangeReportType={setReportType}
        onChangeDateRange={setDateRange}
        onApplyFilters={handleApplyFilters}
      />
      {reportType === 'CASE_STATUS' && (
        <>
          <ReportStatsCards stats={stats} />
          <div className="grid grid-cols-2 gap-8 mb-8">
            <Suspense fallback={<div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading chart...</span></div>}>
              <PieChart
                data={statusDistributionData}
                title="Case Status Distribution"
                isLoading={isLoading}
              />
            </Suspense>
            <Suspense fallback={<div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading chart...</span></div>}>
              <BarChart
                data={ReportsProcessor.processCaseTypesData(caseTypes)}
                title="Case Types"
                isLoading={isLoading}
              />
            </Suspense>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <Suspense fallback={<div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading chart...</span></div>}>
              <PieChart
                data={outcomeData}
                title="Case Outcomes"
                isLoading={isLoading}
              />
            </Suspense>
            <Suspense fallback={<div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center"><span className="text-gray-500">Loading chart...</span></div>}>
              <MultiBarChart
                data={monthlyTrend.map(trend => ({
                  label: trend.month,
                  casesCreated: trend.casesCreated,
                  casesClosed: trend.casesClosed
                }))}
                title="Monthly Case Trends"
                isLoading={isLoading}
              />
            </Suspense>
          </div>
          <ReportsTable
            data={statusDetails}
            title="Case Status Details"
            onExportExcel={handleExportExcel}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
          />
        </>
      )}

      {reportType === 'TASK_COMPLETION' && (
        <Suspense fallback={<div>Loading Task Completion Report...</div>}>
          <TaskCompletionReport
            dateRange={dateRange}
          />
        </Suspense>
      )}

      {reportType === 'AUDIT_LOGS' && (
        <Suspense fallback={<div>Loading Audit Logs Report...</div>}>
          <AuditLogsReport
            dateRange={dateRange}
          />
        </Suspense>
      )}

      {reportType === 'CASE_AGEING' && (
        <Suspense fallback={<div>Loading Case Ageing Report...</div>}>
          <CaseAgeingReport
            dateRange={dateRange}
          />
        </Suspense>
      )}

      {reportType === 'INVESTIGATOR_WORKLOAD' && (
        <Suspense fallback={<div>Loading Investigator Workload Report...</div>}>
          <InvestigatorWorkloadReport
            dateRange={dateRange}
          />
        </Suspense>
      )}
    </PageContainer>
  );
};

export default Reports;