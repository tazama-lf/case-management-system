import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { VolumeTrend } from '../types/reports.types';
import { useInvestigatorSupervisorList } from '../../cases/hooks/useInvestigatorSupervisorList';

interface CaseVolumeTrendChartProps {
  data: VolumeTrend[];
  title: string;
  height?: number;
}

const CaseVolumeTrendChart: React.FC<CaseVolumeTrendChartProps> = ({ data, title, height = 350 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No volume trend data available</p>
        </div>
      </div>
    );
  }

  const { fetchInvestigatorsList, investigators, supervisors, fetchSupervisorsList } = useInvestigatorSupervisorList();


  React.useEffect(() => {
    if (investigators.length === 0)
      fetchInvestigatorsList();
    if (supervisors.length === 0)
      fetchSupervisorsList();
  }, []);

  const getUserNameById = (userId: string) => {

    const inv = investigators.find(i => i.id === userId);
    if (inv) return `${inv.firstName} ${inv.lastName}`;

    const sup = supervisors.find(i => i.id === userId);
    if (sup) return `${sup.firstName} ${sup.lastName}`;

    return userId;
  };

  const investigator = Object.keys(data[0]?.investigators || {});
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  const chartData = data.map((item) => ({
    month: item.month,
    ...item.investigators
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-700 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name} : {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {investigator.map((investigator, index) => (
            <Line
              key={getUserNameById(investigator)}
              type="monotone"
              dataKey={investigator}
              name={getUserNameById(investigator)}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CaseVolumeTrendChart;
