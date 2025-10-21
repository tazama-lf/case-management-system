import React from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import TaskStatsCards from '../components/TaskStatsCards';
import TaskCompletionBarChart from '../components/TaskCompletionBarChart';
import CompletionTimeChart from '../components/CompletionTimeChart';
import CompletionRateTrendChart from '../components/CompletionRateTrendChart';
import TaskStatusPieChart from '../components/TaskStatusPieChart';
import TaskCompletionTable from '../components/TaskCompletionTable';
import { useTaskCompletion } from '../hooks/useReports';

interface TaskCompletionReportProps {
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  dateRange: string;
}

const TaskCompletionReport: React.FC<TaskCompletionReportProps> = ({
  onExportExcel,
  onExportCSV,
  onExportPDF,
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
        onExportExcel={onExportExcel}
        onExportCSV={onExportCSV}
        onExportPDF={onExportPDF}
      />
    </>
  );
};

export default TaskCompletionReport;