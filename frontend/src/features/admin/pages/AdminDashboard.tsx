import React from 'react';
import { PageContainer, Card } from '../../../shared/components/ui';

const AdminDashboard: React.FC = () => {
  return (
    <PageContainer
      title="Admin Dashboard"
      subtitle="System administration and user management"
    >
      <Card>
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
      </Card>
    </PageContainer>
  );
};

export default AdminDashboard;
