import React from 'react';

const AdminDashboard: React.FC = () => {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            System administration and user management
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            System Administration
          </h2>
          <p className="text-gray-600">
            Admin dashboard functionality coming soon. This will include:
          </p>
          <ul className="mt-4 space-y-2 text-gray-600">
            <li>• User management and permissions</li>
            <li>• System configuration</li>
            <li>• Audit log monitoring</li>
            <li>• System health monitoring</li>
            <li>• Data analytics and reporting</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
