import React from 'react';
import { PageContainer } from '../../../shared/components/ui';
import { WorkQueueManagement } from '..';

const AdminDashboard: React.FC = () => {
  // const stats = [
  //   { label: 'Active Work Queues', value: '1,254' },
  //   { label: 'User Accounts', value: '312' },
  //   { label: 'System Roles', value: '4,820' },
  //   { label: 'Pending Approvals', value: '4,820' },
  // ];

  return (
    <PageContainer title="Admin Dashboard">
      {/* <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-6">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div> */}
      <div className="mt-6">
        <WorkQueueManagement />
      </div>
    </PageContainer>
  );
};

export default AdminDashboard;
