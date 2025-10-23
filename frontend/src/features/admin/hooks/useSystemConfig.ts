import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemConfigService, type SystemConfig } from '../services/systemConfigService';
import toast from 'react-hot-toast';


export const useSystemConfig = () => {
  return useQuery({
    queryKey: ['systemConfig'],
    queryFn: () => systemConfigService.getSystemConfig(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
};


export const useUpdateSystemConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<SystemConfig>) => {
      const errors = systemConfigService.validateConfig(config);
      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }
      return systemConfigService.updateSystemConfig(config);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['systemConfig'], data);
      toast.success('System configuration updated successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to update system configuration:', error);
      toast.error(error.message || 'Failed to update system configuration');
    },
  });
};


export const useSystemConfigAvailable = () => {
  const { data, error, isLoading } = useSystemConfig();

  return {
    isAvailable: !isLoading && !error && !!data,
    isLoading,
    error,
  };
};