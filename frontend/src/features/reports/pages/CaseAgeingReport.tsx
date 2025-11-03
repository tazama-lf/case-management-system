import React from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import CaseAgeingStatsCards from '../components/CaseAgeingStatsCards';
import CaseAgeingBarChart from '../components/CaseAgeingBarChart';
import ResolutionTimeTrendChart from '../components/ResolutionTimeTrendChart';
import CaseAgeingPieChart from '../components/CaseAgeingPieChart';
import CaseTypeResolutionChart from '../components/CaseTypeResolutionChart';
import CaseAgeingTable from '../components/CaseAgeingTable';
import { useCaseAgeing } from '../hooks/useReports';
import { exportToExcel, exportToCSV, exportToPDF, formatDataForExport, getColumnsForReport } from '../../../shared/utils/exportUtils';

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

  const { stats, ageingByStatus, resolutionTrend, ageingDistribution, caseTypeResolution, caseDetails } = ageingData || {
    stats: { avgCaseAge: 0, avgResolutionTime: 0, casesOver15Days: 0, casesOver30Days: 0 },
    ageingByStatus: [],
    resolutionTrend: [],
    ageingDistribution: [],
    caseTypeResolution: [],
    caseDetails: []
  };

  const handleExportExcel = () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING');
      const filename = `case-ageing-report-${new Date().toISOString().split('T')[0]}`;
      exportToExcel(formattedData, filename, 'Case Ageing Report');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING');
      const filename = `case-ageing-report-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const formattedData = formatDataForExport(caseDetails, 'CASE_AGEING');
      const filename = `case-ageing-report-${new Date().toISOString().split('T')[0]}`;
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
          <CaseAgeingBarChart
            data={ageingByStatus}
            title="Case Ageing by Status"
            height={320}
          />
        </div>
        <div className="flex-1 w-full md:w-1/2">
          <ResolutionTimeTrendChart
            data={resolutionTrend}
            title="Average Resolution Time Trend"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:space-x-8 space-y-8 md:space-y-0 mb-8">
        <div className="flex-1 w-full md:w-1/2">
          <CaseAgeingPieChart
            data={ageingDistribution}
            title="Case Ageing Distribution"
            size={240}
          />
        </div>
        <div className="flex-1 w-full md:w-1/2">
          <CaseTypeResolutionChart
            data={caseTypeResolution}
            title="Case Type Resolution Time"
          />
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