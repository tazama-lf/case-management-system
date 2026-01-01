import { useState, useEffect } from 'react';
import referenceIdService from '../services/referenceIdService';
import type { ReferenceIdsData } from '../types/admindashboard.types';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useReferenceLookup = () => {
  const [results, setResults] = useState<ReferenceIdsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
  });
  const { success, error } = useToast();

  const fetchReferences = async () => {
    setLoading(true);
    try {
      const response = await referenceIdService.getReferenceIds();
      setResults(response.items);
      setPagination((prev) => ({
        ...prev,
        totalItems: response.totalCount,
      }));
    } catch (err: any) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addReference = async (txnType: string, referenceId: string) => {
    if (!txnType || !referenceId) return;

    setLoading(true);
    try {
      await referenceIdService.createReferenceIds({
        txTp: txnType,
        referenceIdName: referenceId,
      });
      success(
        'Reference Added',
        `Reference ID: ${txnType} ${referenceId} added successfully.`,
      );
      await fetchReferences();
    } catch (err: any) {
      error('Failed to add Reference', err.message);
    } finally {
      setLoading(false);
    }
  };

  const onPageChange = (page: number) =>
    setPagination((prev) => ({ ...prev, currentPage: page }));
  const onPageSizeChange = (size: number) =>
    setPagination((prev) => ({ ...prev, pageSize: size }));

  useEffect(() => {
    fetchReferences();
  }, []);

  return {
    results,
    loading,
    pagination,
    addReference,
    onPageChange,
    onPageSizeChange,
  };
};
