import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer } from '@/shared/components/ui';
import ResultsSummary from '@/shared/components/ui/ResultsSummary';
import ReferenceResultsTable from './ReferenceResultsTable';
import { useReferenceLookup } from '../hooks/useReferences';

const ReferenceDashboardContent: React.FC = () => {
  const [txnType, setTxnType] = useState('');
  const [referenceId, setReferenceId] = useState('');

  const {
    results,
    loading,
    pagination,
    addReference,
    onPageChange,
    onPageSizeChange,
  } = useReferenceLookup();

  const canAdd = txnType && referenceId;

  const handleAddReference = async () => {
    await addReference(txnType, referenceId);
    setTxnType('');
    setReferenceId('');
  };

  return (
    <PageContainer className="space-y-6">
      {/* Add Reference Card */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl shadow-sm border border-slate-200 p-6 mt-8 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-6 gap-4">
          <div className="lg:max-w-md">
            <h4 className="text-2xl font-bold text-gray-900">Add Reference</h4>
            <p className="text-gray-600 mt-1">
              Enter the Transaction Type and System Reference ID to add a new
              reference record.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto">
            <input
              type="text"
              value={txnType}
              onChange={(e) => {
                setTxnType(e.target.value);
              }}
              placeholder="Transaction Type"
              className="h-10 min-w-[180px] flex-1 rounded-md border border-gray-300 px-4 text-sm focus:ring-2 focus:ring-indigo-300"
            />

            <input
              type="text"
              value={referenceId}
              onChange={(e) => {
                setReferenceId(e.target.value);
              }}
              placeholder="System Reference ID"
              className="h-10 min-w-[220px] flex-1 rounded-md border border-gray-300 px-4 text-sm focus:ring-2 focus:ring-indigo-300"
            />

            <button
              disabled={!canAdd}
              onClick={handleAddReference}
              className={`h-10 min-w-[160px] inline-flex items-center justify-center gap-2 px-4 rounded-xl text-white font-medium
        ${canAdd ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-400 cursor-not-allowed'}
      `}
            >
              <PlusIcon className="h-5 w-5" />
              Add Reference
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-20">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent absolute top-0 left-0"></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">
            Loading reference records...
          </p>
        </div>
      ) : results.length > 0 ? (
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
            sort={{ column: 'createdAt', direction: 'desc' }}
            itemType="records"
          />

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <ReferenceResultsTable
              data={results}
              pagination={{
                ...pagination,
                onPageChange,
                totalPages: Math.ceil(
                  pagination.totalItems / pagination.pageSize,
                ),
              }}
            />
          </div>
        </div>
      ) : (
        <div className="py-16 text-center text-gray-400">
          No reference records found.
        </div>
      )}
    </PageContainer>
  );
};

export default ReferenceDashboardContent;
