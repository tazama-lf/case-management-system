import React from 'react';
import { PageContainer } from '../../../shared/components/ui';
import { WorkQueueManagement } from '..';

const AdminDashboard: React.FC = () => {


  return (
    <PageContainer
      title="Admin Dashboard"
    >
      <div className="mt-6">
        <WorkQueueManagement />
      </div>
    </PageContainer>
  );
};

export default AdminDashboard;