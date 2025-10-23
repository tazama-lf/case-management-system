import { useQuery } from '@tanstack/react-query';
import { auditLogService, type AuditLogFilters } from '../services/auditLogService';
import { useState, useCallback } from 'react';


export const useAuditLogs = (initialFilters: AuditLogFilters = {}) => {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 20,
    sortBy: 'timestamp',
    sortOrder: 'desc',
    ...initialFilters,
  });

  const query = useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: () => auditLogService.getAuditLogs(filters),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  const updateFilters = useCallback((newFilters: Partial<AuditLogFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 20,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    });
  }, []);

  return {
    ...query,
    filters,
    updateFilters,
    resetFilters,
  };
};


export const useAuditLogEntry = (id: string | undefined) => {
  return useQuery({
    queryKey: ['auditLog', id],
    queryFn: () => auditLogService.getAuditLogById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};


export const useExportAuditLogs = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportLogs = useCallback(async (filters: AuditLogFilters = {}) => {
    setIsExporting(true);
    setExportError(null);

    try {
      const blob = await auditLogService.exportAuditLogs(filters);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setExportError(error.message || 'Failed to export audit logs');
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    exportLogs,
    isExporting,
    exportError,
  };
};