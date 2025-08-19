import React from 'react';

const CasesDashboard: React.FC = () => {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cases Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage and track investigation cases
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Cases Management
          </h2>
          <p className="text-gray-600">
            Cases dashboard functionality coming soon. This will include:
          </p>
          <ul className="mt-4 space-y-2 text-gray-600">
            <li>• Case list and search functionality</li>
            <li>• Case creation and management</li>
            <li>• Task assignment and tracking</li>
            <li>• Evidence collection</li>
            <li>• Report generation</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CasesDashboard;
