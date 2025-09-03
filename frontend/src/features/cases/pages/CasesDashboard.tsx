import React from 'react';
import { PageContainer, Card } from '../../../shared/components/ui';

const CasesDashboard: React.FC = () => {
  return (
    <PageContainer
      title="Cases Dashboard"
      subtitle="Manage and track investigation cases"
    >
      <Card>
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
      </Card>
    </PageContainer>
  );
};

export default CasesDashboard;
