import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { CaseTypeResolution } from '../types/reports.types';
import { getCaseTypeColor, getCaseTypeDisplay } from '../../../shared/utils/colors';

interface CaseTypeResolutionChartProps {
  data: CaseTypeResolution[];
  title: string;
  height?: number;
}

const CaseTypeResolutionChart: React.FC<CaseTypeResolutionChartProps> = React.memo(({ data, title, height = 350 }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data
      .map(item => {
        const displayType = getCaseTypeDisplay(item.caseType);
        const color = getCaseTypeColor(item.caseType);
        
        return {
          type: displayType,
          averageDays: Math.max(Math.round(item.avgDays || 0), 0),
          caseType: item.caseType,
          color,
          originalAvgDays: item.avgDays || 0
        };
      })
      .filter(item => item.originalAvgDays > 0)
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-gray-500 mb-2">Loading case type data...</p>
            <p className="text-gray-400 text-sm">This chart shows resolution times by case type.</p>
          </div>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-gray-500 mb-2">Processing case data...</p>
            <p className="text-gray-400 text-sm">Please wait while we analyze case resolution times.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="type" tick={{ fontSize: 12 }} />
          <YAxis 
            domain={[0, (dataMax: number) => Math.max(dataMax + 1, 5)]}
            label={{ value: 'Days', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value: number, _name: string, entry: any) => {
              const originalValue = entry.payload?.originalAvgDays || value;
              if (originalValue === 0) {
                return ['< 1 day', 'Time to Resolve'];
              }
              if (originalValue < 1) {
                return [`${originalValue.toFixed(1)} days`, 'Time to Resolve'];
              }
              return [`${Math.round(originalValue)} ${Math.round(originalValue) === 1 ? 'day' : 'days'}`, 'Time to Resolve'];
            }}
            labelFormatter={(label: string) => `Case Type: ${label}`}
          />
          <Bar 
            dataKey="averageDays" 
            fill="#8b5cf6"
            name="Days to Resolution"
            minPointSize={5}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

CaseTypeResolutionChart.displayName = 'CaseTypeResolutionChart';

export default CaseTypeResolutionChart;
