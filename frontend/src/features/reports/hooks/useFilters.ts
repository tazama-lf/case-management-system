import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../shared/services/apiClient';

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
    staleTime: 5 * 60 * 1000,
  });
