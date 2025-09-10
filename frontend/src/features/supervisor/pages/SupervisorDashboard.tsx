import React from 'react';
import { PageContainer, Card } from '../../../shared/components/ui';

const SupervisorDashboard: React.FC = () => {
  return (
    <PageContainer
      title="Supervisor Dashboard"
      subtitle="Oversee team performance and case assignments"
    >
      <Card>
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
      </Card>
    </PageContainer>
  );
};

export default SupervisorDashboard;
