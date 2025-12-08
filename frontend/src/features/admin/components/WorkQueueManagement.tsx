import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer } from '@/shared/components/ui';
import ResultsSummary from '@/shared/components/ui/ResultsSummary';
import AdminWorkQueuesTable from '@/features/admin/components/AdminWorkQueuesTable';
import SearchInput from './SearchInput';
import CreateQueueModal from './modals/CreateQueueModal';
import { useWorkQueueFilter } from '../hooks/useWorkQueueFilter';
import { useCandidateGroups } from '../hooks/useCandidateGroups';

interface WorkQueueManagementProps {
  className?: string;
  onNavigateBack?: () => void;
}

const WorkQueueManagement: React.FC<WorkQueueManagementProps> = ({
  className = ''
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { workQueues, loading, error, pagination, onPageChange, onPageSizeChange, refetch } = useCandidateGroups({
    currentPage: 1,
    pageSize: 10
  });
  const {
    searchTerm,
    setSearchTerm,
    filteredQueues
  } = useWorkQueueFilter(workQueues);

  const handleCreateQueue = () => {
    setCreateModalOpen(true);
  };

  if (error) {
    return (
      <PageContainer
        subtitle="Manage work queues for different user groups"
        className={className}
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error loading work queues</p>
          <p className="text-sm mt-1">{error || 'An error occurred'}</p>
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
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleCreateQueue}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <PlusIcon className="h-4 w-4" />
            Create Queue
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <ResultsSummary
            pagination={{
              currentPage: pagination.currentPage,
              pageSize: pagination.pageSize,
              totalItems: pagination.totalItems,
            }}
            loading={loading}
            lastUpdated={null}
            onPageSizeChange={onPageSizeChange}
            sort={{ column: 'name', direction: 'asc' }}
            itemType="work queues"
          />
          <AdminWorkQueuesTable
            queues={filteredQueues}
            pagination={{
              ...pagination,
              onPageChange
            }}
          />
        </>
      )}
      
      <CreateQueueModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={refetch} 
      />
    </PageContainer>
  );
};

export default WorkQueueManagement;