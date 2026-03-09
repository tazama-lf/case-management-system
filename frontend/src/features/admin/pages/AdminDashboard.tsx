import React from 'react';
import { PageContainer } from '../../../shared/components/ui';
import { WorkQueueManagement } from '..';

const AdminDashboard: React.FC = () => (
  <PageContainer title="Admin Dashboard">
    <div className="mt-1">
      <WorkQueueManagement />
    </div>
  </PageContainer>
);

export default AdminDashboard;
