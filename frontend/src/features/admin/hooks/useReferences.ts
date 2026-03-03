import { useState, useEffect } from 'react';
import referenceIdService from '../services/referenceIdService';
import type { ReferenceIdsData } from '../types/admindashboard.types';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useReferenceLookup = (): {
  results: ReferenceIdsData[];
  loading: boolean;
  pagination: { currentPage: number; pageSize: number; totalItems: number };
  fetchReferences: () => Promise<void>;
  addReference: (txnType: string, referenceId: string) => Promise<void>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
} => {
  const [results, setResults] = useState<ReferenceIdsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
  });
  const { success, error } = useToast();

  const fetchReferences = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await referenceIdService.getReferenceIds();
      setResults(response.items);
      setPagination((prev) => ({
        ...prev,
        totalItems: response.totalCount,
      }));
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to fetch references');
    } finally {
      setLoading(false);
    }
  };

  const addReference = async (txnType: string, referenceId: string): Promise<void> => {
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
    } catch (err: unknown) {
      error('Failed to add Reference', err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const onPageChange = (page: number): void => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };
  const onPageSizeChange = (size: number): void => {
    setPagination((prev) => ({ ...prev, pageSize: size }));
  };

  useEffect(() => {
    fetchReferences();
  }, []);

  return {
    results,
    loading,
    pagination,
    fetchReferences,
    addReference,
    onPageChange,
    onPageSizeChange,
  };
};
