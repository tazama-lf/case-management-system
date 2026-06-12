import React, { useState, Suspense, lazy } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { PageContainer } from '@/shared/components/ui';
import ReportStatsCards from '@/features/reports/components/ReportStatsCards';
import ReportFilters from '@/features/reports/components/ReportFilters';
import ReportsTable from '@/features/reports/components/ReportsTable';
import { useReports } from '@/features/reports/hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '@/shared/utils/exportUtils';
import { getCaseTypeColor } from '@/shared/utils/colors';
import authService from '@/features/auth/services/authService';

const PieChart = lazy(
  async () => await import('@/features/reports/components/PieChart'),
);
const BarChart = lazy(
  async () => await import('@/features/reports/components/BarChart'),
);
const MultiBarChart = lazy(
  async () => await import('@/features/reports/components/MultiBarChart'),
);

const InvestigatorWorkloadReport = lazy(
  async () => await import('./InvestigatorWorkloadReport'),
);
const CaseAgeingReport = lazy(async () => await import('./CaseAgeingReport'));
const EvidenceFindingsReport = lazy(
  async () => await import('./EvidenceFindingsReport'),
);

type ReportType =
  | 'CASE_STATUS'
  | 'CASE_AGEING'
  | 'INVESTIGATOR_WORKLOAD'
  | 'EVIDENCE_FINDINGS';

const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('CASE_STATUS');
  const [dateRange, setDateRange] = useState<
    | 'today'
    | 'yesterday'
    | 'last7'
    | 'last30'
    | 'last90'
    | 'thisMonth'
    | 'lastYear'
  >('last30');
  const [filters, setFilters] = useState({
    caseType: '',
    priority: '',
    investigator: '',
  });
  const {
    data: reportsData,
    isLoading,
    error,
  } = useReports(dateRange, filters);

  const handleExportExcel = () => {
    try {
      const data = getCurrentReportData();
      const formattedData = formatDataForExport(data, reportType);
      const filename = `${reportType.toLowerCase().replace('_', '-')}-report-${new Date().toISOString().split('T')[0]}`;
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
      const filename = `${reportType.toLowerCase().replace('_', '-')}-report-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = () => {
    try {
      const data = getCurrentReportData();
      const formattedData = formatDataForExport(data, reportType);
      const filename = `${reportType.toLowerCase().replace('_', '-')}-report-${new Date().toISOString().split('T')[0]}`;
      const columns = getColumnsForReport(reportType);
      const title = getPageTitle();
      exportToPDF(formattedData, filename, title, columns);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleApplyFilters = (newFilters: {
    caseType: string;
    priority: string;
    investigator: string;
  }) => {
    setFilters(newFilters);
  };

  const getCurrentReportData = () => {
    switch (reportType) {
      case 'CASE_STATUS':
        return statusDetails;
      case 'CASE_AGEING':
        return [];
      case 'INVESTIGATOR_WORKLOAD':
        return [];
      case 'EVIDENCE_FINDINGS':
        return [];
      default:
        return [];
    }
  };

  const isSupervisor = authService.getUser()?.validatedClaims?.CMS_SUPERVISOR === true;

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
            <p className="text-red-700">
              Failed to load reports data. Please try again.
            </p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const {
    stats,
    statusDistribution,
    caseTypes,
    outcomes,
    monthlyTrend,
    statusDetails,
  } = reportsData ?? {
    stats: {
      totalCases: 0,
      closedCases: 0,
      openCases: 0,
      avgResolutionTime: 0,
    },
    statusDistribution: {
      assigned: 0,
      inProgress: 0,
      abandoned: 0,
      draft: 0,
      suspended: 0,
      pendingApproval: 0,
      closed: 0,
    },
    caseTypes: [],
    outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
    monthlyTrend: [],
    statusDetails: [],
  };

  const statusDistributionData = [
    {
      label: 'ASSIGNED',
      value: statusDistribution.assigned,
      color: '#3B82F6', // Blue
      percentage: 0,
    },
    {
      label: 'IN PROGRESS',
      value: statusDistribution.inProgress,
      color: '#06B6D4', // Cyan
      percentage: 0,
    },
    {
      label: 'ABANDONED',
      value: statusDistribution.abandoned,
      color: '#6B7280', // Gray
      percentage: 0,
    },
    {
      label: 'DRAFT',
      value: statusDistribution.draft,
      color: '#F97316', // Orange
      percentage: 0,
    },
    {
      label: 'SUSPENDED',
      value: statusDistribution.suspended,
      color: '#DC2626', // Red
      percentage: 0,
    },
    {
      label: 'PENDING APPROVAL',
      value: statusDistribution.pendingApproval,
      color: '#A855F7', // Purple
      percentage: 0,
    },
    {
      label: 'CLOSED',
      value: statusDistribution.closed,
      color: '#22C55E', // Green
      percentage: 0,
    },
  ].map((item) => ({
    ...item,
    percentage:
      stats.totalCases > 0 ? (item.value / stats.totalCases) * 100 : 0,
  }));

  // Improved outcome data processing with better fallbacks
  const totalOutcomes =
    (outcomes?.resolved || 0) +
    (outcomes?.confirmed || 0) +
    (outcomes?.inconclusive || 0) +
    (outcomes?.pending || 0);
  const outcomeData = [
    {
      label: 'REFUTED',
      value: outcomes?.resolved || 0,
      color: '#10b981',
      percentage: 0,
    },
    {
      label: 'CONFIRMED',
      value: outcomes?.confirmed || 0,
      color: '#ef4444',
      percentage: 0,
    },
    {
      label: 'INCONCLUSIVE',
      value: outcomes?.inconclusive || 0,
      color: '#f59e0b',
      percentage: 0,
    },
    {
      label: 'PENDING',
      value: outcomes?.pending || 0,
      color: '#3b82f6',
      percentage: 0,
    },
  ].map((item) => ({
    ...item,
    percentage: totalOutcomes > 0 ? (item.value / totalOutcomes) * 100 : 0,
  }));

  const getPageTitle = () => {
    switch (reportType) {
      case 'CASE_STATUS':
        return 'Case Status Report';
      case 'CASE_AGEING':
        return 'Case Ageing Report';
      case 'INVESTIGATOR_WORKLOAD':
        return 'Investigator Workload Report';
      case 'EVIDENCE_FINDINGS':
        return 'Evidence Findings Report';
      default:
        return 'Reports Dashboard';
    }
  };

  const getPageSubtitle = () => {
    switch (reportType) {
      case 'CASE_STATUS':
        return 'Overview of cases by status, type, and outcome';
      case 'CASE_AGEING':
        return 'Analysis of case duration from creation to closure';
      case 'INVESTIGATOR_WORKLOAD':
        return 'Overview of investigator workloads and performance metrics';
      case 'EVIDENCE_FINDINGS':
        return 'Comprehensive view of all evidence items linked to investigation findings and conclusions';
      default:
        return 'Overview of cases by status, type, and outcome';
    }
  };

  return (
    <PageContainer title={getPageTitle()} subtitle={getPageSubtitle()}>
      <ReportFilters
        reportType={reportType}
        dateRange={dateRange}
        onChangeReportType={setReportType}
        onChangeDateRange={setDateRange}
        onApplyFilters={handleApplyFilters}
        isSupervisor={isSupervisor}
      />
      {reportType === 'CASE_STATUS' && (
        <>
          <ReportStatsCards stats={stats} />
          <div className="grid grid-cols-2 gap-8 mb-8">
            <Suspense
              fallback={
                <div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                  <span className="text-gray-500">Loading chart...</span>
                </div>
              }
            >
              <PieChart
                data={statusDistributionData}
                title="Case Status Distribution"
                isLoading={isLoading}
              />
            </Suspense>
            <Suspense
              fallback={
                <div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                  <span className="text-gray-500">Loading chart...</span>
                </div>
              }
            >
              <BarChart
                data={caseTypes.map((type) => ({
                  label: type.name,
                  value: type.count,
                  color: getCaseTypeColor(type.name),
                }))}
                title="Case Types"
                isLoading={isLoading}
              />
            </Suspense>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-8">
            <Suspense
              fallback={
                <div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                  <span className="text-gray-500">Loading chart...</span>
                </div>
              }
            >
              <PieChart
                data={outcomeData}
                title="Case Outcomes"
                isLoading={isLoading}
              />
            </Suspense>
            <Suspense
              fallback={
                <div className="h-80 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                  <span className="text-gray-500">Loading chart...</span>
                </div>
              }
            >
              <MultiBarChart
                data={monthlyTrend.map((trend) => ({
                  label: trend.month,
                  casesCreated: trend.casesCreated,
                  casesClosed: trend.casesClosed,
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

      {reportType === 'CASE_AGEING' && (
        <Suspense fallback={<div>Loading Case Ageing Report...</div>}>
          <CaseAgeingReport dateRange={dateRange} />
        </Suspense>
      )}

      {isSupervisor && reportType === 'INVESTIGATOR_WORKLOAD' && (
        <Suspense fallback={<div>Loading Investigator Workload Report...</div>}>
          <InvestigatorWorkloadReport dateRange={dateRange} />
        </Suspense>
      )}

      {reportType === 'EVIDENCE_FINDINGS' && (
        <Suspense fallback={<div>Loading Evidence Findings Report...</div>}>
          <EvidenceFindingsReport dateRange={dateRange} />
        </Suspense>
      )}
    </PageContainer>
  );
};

export default Reports;
