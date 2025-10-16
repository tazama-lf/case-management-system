import React from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { PageContainer } from '../../../shared/components/ui';
import ReportStatsCards from '../components/ReportStatsCards';
import ReportFilters from '../components/ReportFilters';
import PieChart from '../components/PieChart';
import BarChart from '../components/BarChart';
import LineChart from '../components/LineChart';
import ReportsTable from '../components/ReportsTable';
import { useReports } from '../hooks/useReports';

const Reports: React.FC = () => {
  const { data: reportsData, isLoading, error } = useReports();

  const handleExportExcel = () => {
    console.log('Exporting to Excel...');
  };

  const handleExportCSV = () => {
    console.log('Exporting to CSV...');
  };

  const handleExportPDF = () => {
    console.log('Exporting to PDF...');
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

  const { stats, statusDistribution, caseTypes, outcomes, monthlyTrend, statusDetails } = reportsData || {
    stats: { totalCases: 0, closedCases: 0, openCases: 0, avgResolutionTime: 0 },
    statusDistribution: { assigned: 0, inProgress: 0, draft: 0, suspended: 0, pendingApproval: 0, closed: 0 },
    caseTypes: [],
    outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
    monthlyTrend: [],
    statusDetails: []
  };

  const statusDistributionData = [
    { label: 'ASSIGNED', value: statusDistribution.assigned, color: '#3b82f6', percentage: 0 },
    { label: 'IN PROGRESS', value: statusDistribution.inProgress, color: '#10b981', percentage: 0 },
    { label: 'DRAFT', value: statusDistribution.draft, color: '#f59e0b', percentage: 0 },
    { label: 'SUSPENDED', value: statusDistribution.suspended, color: '#ef4444', percentage: 0 },
    { label: 'PENDING APPROVAL', value: statusDistribution.pendingApproval, color: '#8b5cf6', percentage: 0 },
    { label: 'CLOSED', value: statusDistribution.closed, color: '#6b7280', percentage: 0 }
  ].map(item => ({
    ...item,
    percentage: (item.value / stats.totalCases) * 100
  }));

  const outcomeData = [
    { label: 'RESOLVED', value: outcomes.resolved, color: '#10b981', percentage: 0 },
    { label: 'CONFIRMED', value: outcomes.confirmed, color: '#ef4444', percentage: 0 },
    { label: 'INCONCLUSIVE', value: outcomes.inconclusive, color: '#f59e0b', percentage: 0 },
    { label: 'PENDING', value: outcomes.pending, color: '#3b82f6', percentage: 0 }
  ].map(item => ({
    ...item,
    percentage: (item.value / (outcomes.resolved + outcomes.confirmed + outcomes.inconclusive + outcomes.pending)) * 100
  }));

  return (
    <PageContainer
      title="Reports Dashboard"
      subtitle="Overview of cases by status, type, and outcome"
    >
      <ReportFilters
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />

      <ReportStatsCards stats={stats} />

      <div className="grid grid-cols-2 gap-8 mb-8">
        <PieChart 
          data={statusDistributionData} 
          title="Case Status Distribution" 
        />
        <BarChart 
          data={caseTypes.map(type => ({ 
            label: type.name, 
            value: type.count, 
            color: type.color 
          }))} 
          title="Case Types" 
        />
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <PieChart 
          data={outcomeData} 
          title="Case Outcomes" 
        />
        <LineChart 
          data={monthlyTrend.map(trend => ({
            label: trend.month,
            casesCreated: trend.casesCreated,
            casesClosed: trend.casesClosed
          }))} 
          title="Monthly Case Trend" 
        />
      </div>

      <ReportsTable 
        data={statusDetails} 
        title="Case Status Details" 
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />
    </PageContainer>
  );
};

export default Reports;
