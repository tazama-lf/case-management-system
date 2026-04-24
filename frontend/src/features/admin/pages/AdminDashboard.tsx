import React, { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer } from '@/shared/components/ui';
import ResultsSummary from '@/shared/components/ui/ResultsSummary';
import ReferenceResultsTable from '../components/ReferenceResultsTable';
import { useReferenceLookup } from '../hooks/useReferences';

const AdminDashboard: React.FC = () => {
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

  const canAdd = txnType.trim() && referenceId.trim() && !loading;

  const handleAddReference = async () => {
    const trimmedTxnType = txnType.trim();
    const trimmedReferenceId = referenceId.trim();
    
    if (!trimmedTxnType || !trimmedReferenceId) return;
    
    const success = await addReference(trimmedTxnType, trimmedReferenceId);
    if (success) {
      setTxnType('');
      setReferenceId('');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canAdd && !loading) {
      handleAddReference();
    }
  };

  return (
    <PageContainer title="Admin Dashboard" className="space-y-6">
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

          <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto">
            <div className="flex flex-col gap-1">
              <label 
                htmlFor="txnType" 
                className="text-sm font-medium text-gray-700 sr-only"
              >
                Transaction Type
              </label>
              <input
                id="txnType"
                type="text"
                value={txnType}
                onChange={(e) => {
                  setTxnType(e.target.value);
                }}
                placeholder="Transaction Type"
                aria-label="Transaction Type"
                className="h-10 min-w-[180px] flex-1 rounded-md border border-gray-300 px-4 text-sm focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label 
                htmlFor="referenceId" 
                className="text-sm font-medium text-gray-700 sr-only"
              >
                System Reference ID
              </label>
              <input
                id="referenceId"
                type="text"
                value={referenceId}
                onChange={(e) => {
                  setReferenceId(e.target.value);
                }}
                placeholder="System Reference ID"
                aria-label="System Reference ID"
                className="h-10 min-w-[220px] flex-1 rounded-md border border-gray-300 px-4 text-sm focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <button
              type="submit"
              disabled={!canAdd || loading}
              className={`h-10 min-w-[160px] inline-flex items-center justify-center gap-2 px-4 rounded-xl text-white font-medium transition-colors
            ${canAdd && !loading ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-400 cursor-not-allowed'}
          `}
            >
              <PlusIcon className="h-5 w-5" />
              {loading ? 'Adding...' : 'Add Reference'}
            </button>
          </form>
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

export default AdminDashboard;
