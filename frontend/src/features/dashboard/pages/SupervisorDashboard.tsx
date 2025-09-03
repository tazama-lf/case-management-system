import React from 'react';

const SupervisorDashboard: React.FC = () => {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Supervisor Dashboard
          </h1>
          <p className="mt-2 text-gray-600">
            Oversee team performance and case assignments
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Team Management
          </h2>
          <p className="text-gray-600">
            Supervisor dashboard functionality coming soon. This will include:
          </p>
          <ul className="mt-4 space-y-2 text-gray-600">
            <li>• Team performance metrics</li>
            <li>• Case assignment management</li>
            <li>• Workload distribution</li>
            <li>• Team productivity reports</li>
            <li>• Escalation management</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
