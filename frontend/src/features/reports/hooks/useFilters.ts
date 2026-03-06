import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../shared/services/apiClient';
import { FIVE_MINUTES } from '@/shared/constants/timing';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FiltersData {
  caseTypes: FilterOption[];
  priorities: FilterOption[];
  investigators: FilterOption[];
}

export const useFilters = (): ReturnType<typeof useQuery<FiltersData>> =>
  useQuery<FiltersData>({
    queryKey: ['reports', 'filters'],
    queryFn: async () => {
      const response = await apiClient.get<FiltersData>(
        '/api/v1/reports/filters',
      );
      return response;
    },
    staleTime: FIVE_MINUTES,
  });
