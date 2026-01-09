import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { InvestigatorWorkload } from '../types/reports.types';
import { useInvestigatorSupervisorList } from '../../cases/hooks/useInvestigatorSupervisorList';

interface WorkloadBarChartProps {
  data: InvestigatorWorkload[];
  title: string;
  height?: number;
}

const WorkloadBarChart: React.FC<WorkloadBarChartProps> = ({ data, title, height = 350 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
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

  const chartData = data.map((item) => ({
    name: getUserNameById(item.investigatorId),
    'Active Cases': item.activeCases,
    'Pending Tasks': item.pendingTasks
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Active Cases" fill="#3b82f6" />
          <Bar dataKey="Pending Tasks" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WorkloadBarChart;
