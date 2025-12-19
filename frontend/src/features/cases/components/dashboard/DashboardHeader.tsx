import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

interface DashboardHeaderProps {
  onCreateClick: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onCreateClick }) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cases Dashboard</h1>
        <p className="text-gray-600">Manage and track investigation cases</p>
      </div>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <PlusIcon className="h-4 w-4" />
        Create Manually
      </button>
    </div>
  );
};

export default DashboardHeader;
