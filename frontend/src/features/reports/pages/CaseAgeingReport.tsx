import React from 'react';
import { ExclamationCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import CaseAgeingStatsCards, {
  DaysStatsCard,
} from '../components/CaseAgeingStatsCards';
import ReportSectionHeader from '../components/ReportSectionHeader';
import CaseAgeingBarChart from '../components/CaseAgeingBarChart';
import ResolutionTimeTrendChart from '../components/ResolutionTimeTrendChart';
import CaseAgeingPieChart from '../components/CaseAgeingPieChart';
import CaseTypeResolutionChart from '../components/CaseTypeResolutionChart';
import CaseAgeingTable from '../components/CaseAgeingTable';
import { useCaseAgeing } from '../hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../../../shared/utils/exportUtils';
import { useInvestigatorSupervisorList } from '@/features/cases/hooks/useInvestigatorSupervisorList';

interface CaseAgeingReportProps {
  dateRange: string;
  filters?: { caseType: string; priority: string; investigator: string };
}

const CaseAgeingReport: React.FC<CaseAgeingReportProps> = ({
  dateRange,
  filters,
}) => {
  const { data: ageingData, isLoading, error } = useCaseAgeing(
    dateRange,
    filters,
  );
  const { getAssigneeFullName } = useInvestigatorSupervisorList();

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-200 h-64 rounded-lg"></div>
          <div className="bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">
            Failed to load case ageing data. Please try again.
          </p>
        </div>
      </div>
    );
  }

  const {
    stats,
    ageingByStatus,
    resolutionTrend,
    ageingDistribution,
    caseTypeResolution,
    caseDetails,
  } = ageingData ?? {
    stats: {
      avgCaseAge: null,
      avgResolutionTime: null,
      casesOver15Days: 0,
      casesOver30Days: 0,
    },
    ageingByStatus: [],
    resolutionTrend: [],
    ageingDistribution: [],
    caseTypeResolution: [],
    caseDetails: [],
  };

  const handleExportExcel = () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING', getAssigneeFullName);
      const filename = `case-ageing-report-${new Date().toISOString().split('T')[0]}`;
      exportToExcel(formattedData, filename, 'Case Ageing Report');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING', getAssigneeFullName);
      const filename = `case-ageing-report-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING', getAssigneeFullName);
      const filename = `case-ageing-report-${new Date().toISOString().split('T')[0]}`;
      const columns = getColumnsForReport('CASE_AGEING');
      exportToPDF(formattedData, filename, 'Case Ageing Report', columns);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <>
      <ReportSectionHeader
        title="Open Backlog"
        badge="Live snapshot · as-of-now"
        badgeColor="green"
      />
      <CaseAgeingStatsCards stats={stats} />

      <div className="flex flex-col md:flex-row md:space-x-8 space-y-8 md:space-y-0 mb-8">
        <div className="flex-1 w-full md:w-1/2">
          <CaseAgeingBarChart
            data={ageingByStatus}
            title="Case Ageing by Status"
            height={390}
          />
        </div>
        <div className="flex-1 w-full md:w-1/2">
          <CaseAgeingPieChart
            data={ageingDistribution}
            title="Case Ageing Distribution"
            size={320}
          />
        </div>
      </div>

      <div className="mb-8">
        <CaseAgeingTable
          data={caseDetails}
          title="Case Ageing Details"
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
        />
      </div>

      <ReportSectionHeader
        title="Closed Throughput"
        badge="Windowed · closed_at in period"
        badgeColor="blue"
      />

      <div className="flex flex-col md:flex-row md:space-x-8 space-y-8 md:space-y-0">
        <div className="flex-1 w-full md:w-1/2 flex flex-col space-y-8">
          <DaysStatsCard
            title="Avg. Resolution Time"
            days={stats.avgResolutionTime}
            subtitle="Closed cases only"
            icon={<ClockIcon className="h-6 w-6" />}
            color="green"
          />
          <CaseTypeResolutionChart
            data={caseTypeResolution}
            title="Case Type Resolution Time"
          />
        </div>
        <div className="flex-1 w-full md:w-1/2">
          <ResolutionTimeTrendChart
            data={resolutionTrend}
            title="Resolution Time Trend"
            height={410}
          />
        </div>
      </div>
    </>
  );
};

export default CaseAgeingReport;
