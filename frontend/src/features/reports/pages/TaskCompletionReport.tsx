import React from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import TaskStatsCards from '../components/TaskStatsCards';
import TaskCompletionBarChart from '../components/TaskCompletionBarChart';
import CompletionTimeChart from '../components/CompletionTimeChart';
import CompletionRateTrendChart from '../components/CompletionRateTrendChart';
import TaskStatusPieChart from '../components/TaskStatusPieChart';
import TaskCompletionTable from '../components/TaskCompletionTable';
import { useTaskCompletion } from '../hooks/useReports';
import { exportToExcel, exportToCSV, exportToPDF, formatDataForExport, getColumnsForReport } from '../../../shared/utils/exportUtils';

interface TaskCompletionReportProps {
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  dateRange: string;
}

const TaskCompletionReport: React.FC<TaskCompletionReportProps> = ({
  dateRange
}) => {
  const { data: taskData, isLoading, error } = useTaskCompletion(dateRange);

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
          <p className="text-red-700">Failed to load task completion data. Please try again.</p>
        </div>
      </div>
    );
  }

  const { stats, completionByType, avgCompletionTime, completionTrend, statusDistribution, taskDetails } = taskData || {
    stats: { totalTasks: 0, completionRate: 0, avgCompletionTime: 0, overdueTasks: 0 },
    completionByType: [],
    avgCompletionTime: [],
    completionTrend: [],
    statusDistribution: [],
    taskDetails: []
  };

  const handleExportExcel = () => {
    try {
      const formattedData = formatDataForExport(taskDetails, 'TASK_COMPLETION');
      const filename = `task-completion-report-${new Date().toISOString().split('T')[0]}`;
      exportToExcel(formattedData, filename, 'Task Completion Report');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportCSV = () => {
    try {
      const formattedData = formatDataForExport(taskDetails, 'TASK_COMPLETION');
      const filename = `task-completion-report-${new Date().toISOString().split('T')[0]}`;
      exportToCSV(formattedData, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const formattedData = formatDataForExport(taskDetails, 'TASK_COMPLETION');
      const filename = `task-completion-report-${new Date().toISOString().split('T')[0]}`;
      const columns = getColumnsForReport('TASK_COMPLETION');
      await exportToPDF(formattedData, filename, 'Task Completion Report', columns);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <>
      <TaskStatsCards stats={stats} />

      <div className="grid grid-cols-2 gap-8 mb-8">
        <TaskCompletionBarChart
          data={completionByType}
          title="Task Completion by Type"
        />
        <CompletionTimeChart
          data={avgCompletionTime}
          title="Average Completion Time (Days)"
        />
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <CompletionRateTrendChart
          data={completionTrend}
          title="Task Completion Rate Trend"
        />
        <TaskStatusPieChart
          data={statusDistribution}
          title="Task Status Distribution"
        />
      </div>

      <TaskCompletionTable
        data={taskDetails}
        title="Task Completion Details"
        onExportExcel={handleExportExcel}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />
    </>
  );
};

export default TaskCompletionReport;