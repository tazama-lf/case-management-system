import React, { Suspense, lazy } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import CaseAgeingStatsCards from '../components/CaseAgeingStatsCards';
import CaseAgeingTable from '../components/CaseAgeingTable';
import { ChartLoadingFallback } from '../components/ChartComponents';

const CaseAgeingBarChart = lazy(() => import('../components/CaseAgeingBarChart'));
const ResolutionTimeTrendChart = lazy(() => import('../components/ResolutionTimeTrendChart'));
const CaseAgeingPieChart = lazy(() => import('../components/CaseAgeingPieChart'));
const CaseTypeResolutionChart = lazy(() => import('../components/CaseTypeResolutionChart'));
import { useCaseAgeing } from '../hooks/useReports';
import { exportToExcel, exportToCSV, exportToPDF, formatDataForExport, getColumnsForReport } from '../../../shared/utils/exportUtils';
import { generateReportFilename } from '@/shared/utils/stringUtils';

interface CaseAgeingReportProps {
  dateRange: string;
}

const CaseAgeingReport: React.FC<CaseAgeingReportProps> = ({
  dateRange
}) => {
  const { data: ageingData, isLoading, error } = useCaseAgeing(dateRange);

  if (isLoading) {
    return (
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
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-700">Failed to load case ageing data. Please try again.</p>
        </div>
      </div>
    );
  }

  const {
    stats = { avgCaseAge: 0, avgResolutionTime: 0, casesOver15Days: 0, casesOver30Days: 0 },
    ageingByStatus = [],
    resolutionTrend = [],
    ageingDistribution = [],
    caseTypeResolution = [],
    caseDetails = []
  } = ageingData || {};

  const handleExportExcel = () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING');
      const filename = generateReportFilename('case-ageing-report');
      exportToExcel(formattedData, filename, 'Case Ageing Report');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING');
      const filename = generateReportFilename('case-ageing-report');
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING');
      const filename = generateReportFilename('case-ageing-report');
      const columns = getColumnsForReport('CASE_AGEING');
      await exportToPDF(formattedData, filename, 'Case Ageing Report', columns);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <>
      <CaseAgeingStatsCards stats={stats} />

      <div className="flex flex-col md:flex-row md:space-x-8 space-y-8 md:space-y-0 mb-8">
        <div className="flex-1 w-full md:w-1/2">
          <Suspense fallback={<ChartLoadingFallback />}>
            <CaseAgeingBarChart
              data={ageingByStatus}
              title="Case Ageing by Status"
              height={320}
            />
          </Suspense>
        </div>
        <div className="flex-1 w-full md:w-1/2">
          <Suspense fallback={<ChartLoadingFallback />}>
            <ResolutionTimeTrendChart
              data={resolutionTrend}
              title="Average Resolution Time Trend"
            />
          </Suspense>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:space-x-8 space-y-8 md:space-y-0 mb-8">
        <div className="flex-1 w-full md:w-1/2">
          <Suspense fallback={<ChartLoadingFallback />}>
            <CaseAgeingPieChart
              data={ageingDistribution}
              title="Case Ageing Distribution"
              size={240}
            />
          </Suspense>
        </div>
        <div className="flex-1 w-full md:w-1/2">
          <Suspense fallback={<ChartLoadingFallback />}>
            <CaseTypeResolutionChart
              data={caseTypeResolution}
              title="Case Type Resolution Time"
            />
          </Suspense>
        </div>
      </div>

      <CaseAgeingTable
        data={caseDetails}
        title="Case Ageing Details"
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />
    </>
  );
};

export default CaseAgeingReport;