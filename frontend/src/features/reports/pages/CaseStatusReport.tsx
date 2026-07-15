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

/** Case Types bar chart: FRAUD/AML share one hue family (light vs. medium blue) rather than the app-wide red/purple badge colors. */
const getCaseTypeChartColor = (caseType: string | null): string => {
  switch (caseType) {
    case 'FRAUD':
      return '#7dd3fc'; // light blue
    case 'AML':
      return '#2563eb'; // medium blue
    default:
      return '#93c5fd';
  }
};

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
    | 'all'
  >('all');
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

  const isSupervisor =
    authService.getUser()?.validatedClaims?.CMS_SUPERVISOR === true;

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
    caseTypes,
    outcomes,
    monthlyTrend,
    statusDetails,
  } = reportsData ?? {
    stats: {
      totalCases: 0,
      closedCases: 0,
      openCases: 0,
      openAssignedCases: 0,
      avgResolutionTime: null,
    },
    statusDistribution: {
      draft: 0,
      pendingCaseCreationApproval: 0,
      readyForAssignment: 0,
      assigned: 0,
      inProgress: 0,
      suspended: 0,
      pendingFinalApproval: 0,
      pendingCaseReopeningApproval: 0,
      autoclosedConfirmed: 0,
      autoclosedRefuted: 0,
      closedRefuted: 0,
      closedConfirmed: 0,
      closedInconclusive: 0,
      abandoned: 0,
    },
    caseTypes: [],
    outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
    monthlyTrend: [],
    statusDetails: [],
  };

  const statusColors = ['#94A3B8', '#38BDF8', '#F59E0B', '#A78BFA', '#6366F1', '#FB7185', '#8B5CF6', '#7C3AED'];
  const statusDistributionData = statusDetails.map((detail, index) => ({
    label: detail.status,
    value: detail.count,
    color: statusColors[index % statusColors.length],
    percentage: 0,
  })).map((item) => ({
    ...item,
    percentage:
      stats.openCases > 0 ? (item.value / stats.openCases) * 100 : 0,
  }));

  // Improved outcome data processing with better fallbacks
  const totalOutcomes =
    (outcomes?.refuted ?? outcomes?.resolved ?? 0) +
    (outcomes?.confirmed || 0) +
    (outcomes?.inconclusive || 0);
  const outcomeData = [
    {
      label: 'REFUTED',
      value: outcomes?.refuted ?? outcomes?.resolved ?? 0,
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
          <div className="mb-3 flex items-center gap-3 border-t border-gray-200 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Live Workload
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
              created_at in window
            </span>
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
                data={statusDistributionData}
                title="Case Status Distribution"
                isLoading={isLoading}
                showZeroLegend
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
                  color: getCaseTypeChartColor(type.name),
                }))}
                title="Case Types"
                isLoading={isLoading}
                horizontal
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
          <div className="my-8 flex items-center gap-3 border-t border-gray-200 pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Closed Throughput
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              closed_at in window
            </span>
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
        </>
      )}

      {reportType === 'CASE_AGEING' && (
        <Suspense fallback={<div>Loading Case Ageing Report...</div>}>
          <CaseAgeingReport dateRange={dateRange} filters={filters} />
        </Suspense>
      )}

      {isSupervisor && reportType === 'INVESTIGATOR_WORKLOAD' && (
        <Suspense fallback={<div>Loading Investigator Workload Report...</div>}>
          <InvestigatorWorkloadReport dateRange={dateRange} filters={filters} />
        </Suspense>
      )}

      {reportType === 'EVIDENCE_FINDINGS' && (
        <Suspense fallback={<div>Loading Evidence Findings Report...</div>}>
          <EvidenceFindingsReport dateRange={dateRange} filters={filters} />
        </Suspense>
      )}
    </PageContainer>
  );
};

export default Reports;
