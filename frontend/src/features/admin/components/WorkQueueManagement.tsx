import React, { useState} from 'react';
import { PageContainer } from '@/shared/components/ui';
import type { WorkQueue } from '@/features/admin/types/admindashboard.types';
import WorkQueuesTable from '@/features/admin/components/WorkQueuesTable';
import StatusFilter from '@/features/admin/components/StatusFilter';
import SearchInput from './SearchInput';
import { INITIAL_WORK_QUEUES } from '@/features/admin/constants/workQueues';
import { ROLE_COLORS, TASK_TYPE_COLORS } from '../constants/colors';
import { useWorkQueueFilter } from '../hooks/useWorkQueueFilter';


interface WorkQueueManagementProps {
  className?: string;
  onNavigateBack?: () => void;
}

const WorkQueueManagement: React.FC<WorkQueueManagementProps> = ({ 
  className = '', 
  onNavigateBack 
}) => {
  const [workQueues] = useState<WorkQueue[]>(INITIAL_WORK_QUEUES);
  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    filteredQueues
  } = useWorkQueueFilter(workQueues);

  return (
    <PageContainer
      subtitle="Manage work queues for different user groups"
      className={className}
    >
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search work queues..."
          />
          <StatusFilter 
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>
      <WorkQueuesTable 
        queues={filteredQueues}
        roleColors={ROLE_COLORS}
        taskTypeColors={TASK_TYPE_COLORS}
      />
    </PageContainer>
  );
};

export default WorkQueueManagement;