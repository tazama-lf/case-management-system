/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances */
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
    userId: string,
    filterType: string,
  ): Promise<UserDefinedFilters[]> {
    try {
      const response = await apiClient.get<UserDefinedFilters[]>(
        `${this.baseUrl}/user/${userId}/filterType/${filterType}`,
      );
      return Array.isArray(response) ? response : [];
    } catch (error: unknown) {
      console.error(
        'FilterService: Failed to get filters for user:',
        userId,
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
    } catch (error: unknown) {
      // Check for 409 Conflict - duplicate filter
      const err = error as { response?: { status?: number } } | undefined;
      if (err?.response?.status === 409) {
        throw new Error('FILTER_ALREADY_EXISTS', { cause: error });
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

    return data as UserFilters;
  }

  private handleError(error: unknown, operation: string): Error {
    const err = error as
      | { response?: { data?: ApiErrorResponse }; message?: string }
      | undefined;
    if (err?.response?.data) {
      return new Error(err.response.data.message || `Failed to ${operation}`);
    }
    return new Error(
      `Failed to ${operation}: ${err?.message ?? 'Unknown error'}`,
    );
  }
}

export const filterService = new FilterService();
/* eslint-enable @typescript-eslint/class-methods-use-this */
