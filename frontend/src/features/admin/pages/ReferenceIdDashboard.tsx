import React from 'react';
import { PageContainer } from '../../../shared/components/ui';
import { ReferenceDashboardContent } from '..';

const AdminDashboard: React.FC = () => {


  return (
    <PageContainer
      title="Reference ID Dashboard"
    >
      <ReferenceDashboardContent />
    </PageContainer>
  );
};

export default AdminDashboard;