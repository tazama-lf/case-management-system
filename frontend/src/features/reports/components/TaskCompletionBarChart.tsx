import React from 'react';
import type { TaskCompletionByType } from '../types/reports.types';

interface TaskCompletionBarChartProps {
  data: TaskCompletionByType[];
  title: string;
  height?: number;
}

const TaskCompletionBarChart: React.FC<TaskCompletionBarChartProps> = ({ data, title, height = 200 }) => {
  const maxValue = Math.max(...data.map(item => item.total));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-end justify-between space-x-2" style={{ height }}>
        {data.map((item, index) => {
          const totalHeight = (item.total / maxValue) * (height - 40);
          const completedHeight = (item.completed / maxValue) * (height - 40);

          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className="text-xs font-medium text-gray-900 mb-1">
                {item.total}
              </div>
              <div className="w-full relative">
                <div
                  className="w-full rounded-t bg-gray-200"
                  style={{ height: `${totalHeight}px` }}
                />
                <div
                  className="w-full rounded-t bg-green-500 absolute bottom-0"
                  style={{ height: `${completedHeight}px` }}
                />
              </div>
              <div className="text-xs text-gray-600 mt-2 text-center">
                {item.type}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center mt-4 space-x-6">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">Completed</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-gray-200 rounded-full mr-2" />
          <span className="text-sm text-gray-600">Pending</span>
        </div>
      </div>
    </div>
  );
};

export default TaskCompletionBarChart;
