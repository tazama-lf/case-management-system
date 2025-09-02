import React from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface DashboardHeaderProps {
  onDownloadReport: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onDownloadReport }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Triage and investigate alerts, convert to cases, and manage alert workflows
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onDownloadReport}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Overturned Alerts Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
