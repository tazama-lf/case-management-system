import React from 'react';
import { PageContainer } from '@/shared/components/ui';
import type { WorkQueue } from '@/features/admin/types/admindashboard.types';
import WorkQueuesTable from '@/features/admin/components/WorkQueuesTable';
import StatusFilter from '@/features/admin/components/StatusFilter';
import SearchInput from './SearchInput';
import { ROLE_COLORS, TASK_TYPE_COLORS } from '../constants/colors';
import { useWorkQueueFilter } from '../hooks/useWorkQueueFilter';
import { useWorkQueues } from '../hooks/useWorkQueues';
import workQueueService from '../services/workQueueService';

interface WorkQueueManagementProps {
  className?: string;
  onNavigateBack?: () => void;
}

const WorkQueueManagement: React.FC<WorkQueueManagementProps> = ({ 
  className = '', 
  onNavigateBack 
}) => {
  const { workQueues, loading, error, refetch } = useWorkQueues();
  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    filteredQueues
  } = useWorkQueueFilter(workQueues);

  const handleEdit = async (queue: WorkQueue) => {
    try {
      // TODO: Implement edit modal/form
      console.log('Edit queue:', queue);
      // await workQueueService.updateWorkQueue(queue.id, updatedData);
      // await refetch();
    } catch (err) {
      console.error('Failed to update work queue:', err);
    }
  };

  const handleDelete = async (queueId: string) => {
    try {
      await workQueueService.deleteWorkQueue(queueId);
      await refetch();
    } catch (err) {
      console.error('Failed to delete work queue:', err);
    }
  };

  if (error) {
    return (
      <PageContainer
        subtitle="Manage work queues for different user groups"
        className={className}
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error loading work queues</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </PageContainer>
    );
  }

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
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <WorkQueuesTable 
          queues={filteredQueues}
          roleColors={ROLE_COLORS}
          taskTypeColors={TASK_TYPE_COLORS}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </PageContainer>
  );
};

export default WorkQueueManagement;