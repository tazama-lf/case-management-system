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
  className = '',
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const {
    workQueues,
    loading,
    error,
    pagination,
    onPageChange,
    onPageSizeChange,
    refetch,
  } = useCandidateGroups({
    currentPage: 1,
    pageSize: 10,
  });
  const { searchTerm, setSearchTerm, filteredQueues } =
    useWorkQueueFilter(workQueues);

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
            onClick={async () => {
              await refetch();
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className={className}>
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl shadow-sm border border-slate-200 p-6 mt-8 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="max-w-md">
            <h4 className="text-2xl font-bold text-gray-900">Work Queues</h4>
            <p className="text-gray-600 mt-1">
              Manage work queues for different user groups
            </p>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search work queues..."
            />

            <button
              onClick={handleCreateQueue}
              className="h-10 min-w-[160px] inline-flex items-center justify-center gap-2 px-4 rounded-xl text-white font-medium bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5" />
              Create New Queue
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
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

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <AdminWorkQueuesTable
              queues={filteredQueues}
              pagination={{
                ...pagination,
                onPageChange,
              }}
            />
          </div>
        </div>
      )}

      <CreateQueueModal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
        }}
        onCreate={refetch}
      />
    </PageContainer>
  );
};

export default WorkQueueManagement;
