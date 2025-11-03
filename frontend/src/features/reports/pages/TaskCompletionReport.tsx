import React, { Suspense } from 'react';
import { exportToExcel, exportToCSV, exportToPDF, formatDataForExport, getColumnsForReport } from '../../../shared/utils/exportUtils';

const TaskStatsCards = React.lazy(() => import('../components/TaskStatsCards'));
const TaskCompletionBarChart = React.lazy(() => import('../components/TaskCompletionBarChart'));
const CompletionTimeChart = React.lazy(() => import('../components/CompletionTimeChart'));
const CompletionRateTrendChart = React.lazy(() => import('../components/CompletionRateTrendChart'));
const TaskStatusPieChart = React.lazy(() => import('../components/TaskStatusPieChart'));
const TaskCompletionTable = React.lazy(() => import('../components/TaskCompletionTable'));

interface TaskCompletionReportProps {
  dateRange: string;
}

const dummyTaskData = {
  stats: {
    totalTasks: 120,
    completionRate: 75,
    avgCompletionTime: 3,
    overdueTasks: 5
  },
  completionByType: [
    { type: 'INVESTIGATION', total: 45, completed: 38, pending: 7 },
    { type: 'APPROVAL', total: 25, completed: 22, pending: 3 },
    { type: 'REVIEW', total: 30, completed: 20, pending: 10 },
    { type: 'EVIDENCE_COLLECTION', total: 20, completed: 15, pending: 5 }
  ],
  avgCompletionTime: [
    { type: 'INVESTIGATION', avgDays: 4 },
    { type: 'APPROVAL', avgDays: 2 },
    { type: 'REVIEW', avgDays: 3 },
    { type: 'EVIDENCE_COLLECTION', avgDays: 5 }
  ],
  completionTrend: [
    { week: 'May 2025', completionRate: 70 },
    { week: 'Jun 2025', completionRate: 72 },
    { week: 'Jul 2025', completionRate: 68 },
    { week: 'Aug 2025', completionRate: 75 },
    { week: 'Sep 2025', completionRate: 78 },
    { week: 'Oct 2025', completionRate: 75 }
  ],
  statusDistribution: [
    { status: 'Completed', count: 90, percentage: 75, color: '#10b981' },
    { status: 'In Progress', count: 15, percentage: 12, color: '#3b82f6' },
    { status: 'Pending', count: 10, percentage: 8, color: '#f59e0b' },
    { status: 'Overdue', count: 5, percentage: 4, color: '#ef4444' }
  ],
  taskDetails: [
    { taskType: 'INVESTIGATION', total: 45, completed: 38, completionRate: 84, avgTime: 4, trend: 0 },
    { taskType: 'APPROVAL', total: 25, completed: 22, completionRate: 88, avgTime: 2, trend: 0 },
    { taskType: 'REVIEW', total: 30, completed: 20, completionRate: 67, avgTime: 3, trend: 0 },
    { taskType: 'EVIDENCE_COLLECTION', total: 20, completed: 15, completionRate: 75, avgTime: 5, trend: 0 }
  ]
};

const TaskCompletionReport: React.FC<TaskCompletionReportProps> = ({ dateRange: _dateRange }) => {
  const taskData = dummyTaskData;
  const isLoading = false;

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

  const { stats, completionByType, avgCompletionTime, completionTrend, statusDistribution, taskDetails } = taskData;

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
      <Suspense fallback={<div className="bg-gray-200 h-32 rounded-lg animate-pulse"></div>}>
        <TaskStatsCards stats={stats} />
      </Suspense>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <Suspense fallback={<div className="bg-gray-200 h-64 rounded-lg animate-pulse"></div>}>
          <TaskCompletionBarChart
            data={completionByType}
            title="Task Completion by Type"
          />
        </Suspense>
        <Suspense fallback={<div className="bg-gray-200 h-64 rounded-lg animate-pulse"></div>}>
          <CompletionTimeChart
            data={avgCompletionTime}
            title="Average Completion Time (Days)"
          />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <Suspense fallback={<div className="bg-gray-200 h-64 rounded-lg animate-pulse"></div>}>
          <CompletionRateTrendChart
            data={completionTrend}
            title="Task Completion Rate Trend"
          />
        </Suspense>
        <Suspense fallback={<div className="bg-gray-200 h-64 rounded-lg animate-pulse"></div>}>
          <TaskStatusPieChart
            data={statusDistribution}
            title="Task Status Distribution"
          />
        </Suspense>
      </div>

      <Suspense fallback={<div className="bg-gray-200 h-64 rounded-lg animate-pulse"></div>}>
        <TaskCompletionTable
          data={taskDetails}
          title="Task Completion Details"
          onExportExcel={handleExportExcel}
          onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
        />
      </Suspense>
    </>
  );
};

export default TaskCompletionReport;