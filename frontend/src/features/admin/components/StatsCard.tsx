import React from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'yellow' | 'green';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500 text-white',
    red: 'bg-red-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    green: 'bg-green-500 text-white',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
};

export default StatsCard;
