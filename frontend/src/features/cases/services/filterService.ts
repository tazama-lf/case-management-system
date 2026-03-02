import apiClient from '../../../shared/services/apiClient';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';

export interface UserFilters {
  filter_Id: number;
  user_id: string;
  created_at: string;
  user_filters: string;
  filter_type: string;
  updated_at: string;
}

export interface CreateUserFilters {
  user_id?: string;
  userFilters: string;
  filterType: string;
}

export interface UserDefinedFilters extends UserFilters {
  filters: UserFilters[];
}

export class FilterService {
  private readonly baseUrl = '/api/v1/filter';

  async getFilters(
    user_id: string,
    filterType: string,
  ): Promise<UserDefinedFilters[]> {
    try {
      const response = await apiClient.get<UserDefinedFilters[]>(
        `${this.baseUrl}/user/${user_id}/filterType/${filterType}`,
      );
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      console.error(
        'FilterService: Failed to get filters for user:',
        user_id,
        error,
      );
      throw this.handleError(error, 'get user defined filter failed');
    }
  }

  async createFilter(createFilterDTO: CreateUserFilters): Promise<UserFilters> {
    try {
      const response = await apiClient.post<UserFilters>(
        `${this.baseUrl}/create`,
        createFilterDTO,
      );
      return this.validateFilterResponse(response);
    } catch (error: any) {
      // Check for 409 Conflict - duplicate filter
      if (error.response?.status === 409) {
        throw new Error('FILTER_ALREADY_EXISTS');
      }

      throw this.handleError(error, 'create filter');
    }
  }

  private validateFilterResponse(data: unknown): UserFilters {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid filter data received');
    }

    if ('filter_Id' in data) {
      return data as UserFilters;
    }

    if (typeof data === 'object' && data !== null) {
      return data as UserFilters;
    }

    throw new Error('Filter ID is missing from response');
  }

  private handleError(error: any, operation: string): Error {
    if (error.response?.data) {
      const apiError = error.response.data as ApiErrorResponse;
      return new Error(apiError.message || `Failed to ${operation}`, { cause: error });
    }
    return new Error(`Failed to ${operation}: ${error.message}`, { cause: error });
  }
}

export const filterService = new FilterService();
