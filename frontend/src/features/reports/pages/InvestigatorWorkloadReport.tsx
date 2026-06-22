import React from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import InvestigatorStatsCards from '../components/InvestigatorStatsCards';
import WorkloadBarChart from '../components/WorkloadBarChart';
import CaseVolumeTrendChart from '../components/CaseVolumeTrendChart';
import ResolutionEfficiencyChart from '../components/ResolutionEfficiencyChart';
import OutcomeDistributionChart from '../components/OutcomeDistributionChart';
import InvestigatorPerformanceTable from '../components/InvestigatorPerformanceTable';
import { useInvestigatorWorkload } from '../hooks/useReports';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../../../shared/utils/exportUtils';
import { useInvestigatorSupervisorList } from '@/features/cases/hooks/useInvestigatorSupervisorList';

interface InvestigatorWorkloadReportProps {
  dateRange: string;
}

const InvestigatorWorkloadReport: React.FC<InvestigatorWorkloadReportProps> = ({
  dateRange,
}) => {
  const { getAssigneeFullName } = useInvestigatorSupervisorList();
  const {
    data: workloadData,
    isLoading,
    error,
  } = useInvestigatorWorkload(dateRange);

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
          <p className="text-red-700">
            Failed to load investigator workload data. Please try again.
          </p>
        </div>
      </div>
    );
  }

  const {
    stats,
    workloadData: workload,
    volumeTrend,
    efficiencyData,
    outcomeData,
    performanceData,
  } = workloadData ?? {
    stats: {
      totalInvestigators: 0,
      avgCasesPerInvestigator: 0,
      avgResolutionTime: 0,
      caseClosureRate: 0,
    },
    workloadData: [],
    volumeTrend: [],
    efficiencyData: [],
    outcomeData: [],
    performanceData: [],
  };

  const handleExportExcel = () => {
    try {
      const formattedData = formatDataForExport(
        performanceData,
        'INVESTIGATOR_WORKLOAD',
        getAssigneeFullName
      );
      const filename = `investigator-workload-report-${new Date().toISOString().split('T')[0]}`;
      exportToExcel(formattedData, filename, 'Investigator Workload Report');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const formattedData = formatDataForExport(
        performanceData,
        'INVESTIGATOR_WORKLOAD',
        getAssigneeFullName
      );
      const filename = `investigator-workload-report-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = () => {
    try {
      const formattedData = formatDataForExport(
        performanceData,
        'INVESTIGATOR_WORKLOAD',
        getAssigneeFullName
      );
      const filename = `investigator-workload-report-${new Date().toISOString().split('T')[0]}`;
      const columns = getColumnsForReport('INVESTIGATOR_WORKLOAD');
      exportToPDF(
        formattedData,
        filename,
        'Investigator Workload Report',
        columns,
      );
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <>
      <InvestigatorStatsCards stats={stats} />

      <div className="grid grid-cols-2 gap-8 mb-8">
        <WorkloadBarChart
          data={workload}
          title="Current Workload by Investigator"
        />
        <CaseVolumeTrendChart
          data={volumeTrend}
          title="Case Volume Trend by Investigator"
        />
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <ResolutionEfficiencyChart
          data={efficiencyData}
          title="Case Resolution Efficiency (Avg. Day)"
        />
        <OutcomeDistributionChart
          data={outcomeData}
          title="Case Outcome Distribution by Investigator"
        />
      </div>

      <InvestigatorPerformanceTable
        data={performanceData}
        title="Investigator Performance Details"
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />
    </>
  );
};

export default InvestigatorWorkloadReport;
