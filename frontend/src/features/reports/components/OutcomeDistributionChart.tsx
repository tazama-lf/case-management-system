import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { OutcomeDistribution } from '../types/reports.types';

interface OutcomeDistributionChartProps {
  data: OutcomeDistribution[];
  title: string;
  height?: number;
}

const OutcomeDistributionChart: React.FC<OutcomeDistributionChartProps> = ({ data, title, height = 350 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No outcome data available</p>
        </div>
      </div>
    );
  }

 
  const chartData = data.map(item => ({
    name: item.name,
    Confirmed: item.confirmed,
    Refuted: item.refuted,
    Inconclusive: item.inconclusive
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="rect"
          />
          <Bar dataKey="Confirmed" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Refuted" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Inconclusive" fill="#f97316" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OutcomeDistributionChart;
