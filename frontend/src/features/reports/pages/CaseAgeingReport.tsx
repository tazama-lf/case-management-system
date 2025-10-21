import React from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import CaseAgeingStatsCards from '../components/CaseAgeingStatsCards';
import CaseAgeingBarChart from '../components/CaseAgeingBarChart';
import ResolutionTimeTrendChart from '../components/ResolutionTimeTrendChart';
import CaseAgeingPieChart from '../components/CaseAgeingPieChart';
import CaseTypeResolutionChart from '../components/CaseTypeResolutionChart';
import CaseAgeingTable from '../components/CaseAgeingTable';
import { useCaseAgeing } from '../hooks/useReports';

interface CaseAgeingReportProps {
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  dateRange: string;
}

const CaseAgeingReport: React.FC<CaseAgeingReportProps> = ({
  onExportExcel,
  onExportCSV,
  onExportPDF,
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

  return (
    <>
      <CaseAgeingStatsCards stats={stats} />

      <div className="grid grid-cols-2 gap-8 mb-8">
        <CaseAgeingBarChart 
          data={ageingByStatus} 
          title="Case Ageing by Status" 
        />
        <ResolutionTimeTrendChart 
          data={resolutionTrend} 
          title="Average Resolution Time Trend" 
        />
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <CaseAgeingPieChart 
          data={ageingDistribution} 
          title="Case Ageing Distribution" 
        />
        <CaseTypeResolutionChart 
          data={caseTypeResolution} 
          title="Case Type vs Resolution Time" 
        />
      </div>

      <CaseAgeingTable 
        data={caseDetails} 
        title="Case Ageing Details" 
        onExportExcel={onExportExcel}
        onExportCSV={onExportCSV}
        onExportPDF={onExportPDF}
      />
    </>
  );
};

export default CaseAgeingReport;