import React from 'react';
import type { InvestigatorWorkload } from '../types/reports.types';

interface WorkloadBarChartProps {
  data: InvestigatorWorkload[];
  title: string;
  height?: number;
}

const WorkloadBarChart: React.FC<WorkloadBarChartProps> = ({ data, title, height = 200 }) => {
  const maxValue = Math.max(...data.map(item => item.activeCases + item.pendingTasks));
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4" style={{ height }}>
        {data.map((item, index) => {
          const activeBarWidth = (item.activeCases / maxValue) * 100;
          const pendingBarWidth = (item.pendingTasks / maxValue) * 100;
          
          return (
            <div key={index} className="flex items-center">
              <div className="w-24 text-sm text-gray-600 truncate mr-4">
                {item.name}
              </div>
              <div className="flex-1 flex items-center space-x-2">
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div 
                    className="bg-blue-500 h-6 rounded-l-full"
                    style={{ width: `${activeBarWidth}%` }}
                  />
                  <div 
                    className="bg-purple-500 h-6 rounded-r-full absolute top-0"
                    style={{ 
                      width: `${pendingBarWidth}%`, 
                      left: `${activeBarWidth}%` 
                    }}
                  />
                </div>
                <div className="w-16 text-xs text-gray-500 text-right">
                  {item.activeCases + item.pendingTasks}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center mt-4 space-x-6">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">Active Cases</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-purple-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">Pending Tasks</span>
        </div>
      </div>
    </div>
  );
};

export default WorkloadBarChart;
