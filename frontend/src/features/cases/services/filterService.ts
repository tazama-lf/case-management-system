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

const HTTP_CONFLICT = 409;

export class FilterService {
  private readonly baseUrl = '/api/v1/filter';

  private static validateFilterResponse(data: unknown): UserFilters {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid filter data received');
    }

    if ('filter_Id' in data) {
      return data as UserFilters;
    }

    return data as UserFilters;
  }

  private static handleError(error: unknown, operation: string): Error {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as { response?: unknown }).response === 'object' &&
      (error as { response?: { data?: ApiErrorResponse } }).response?.data
    ) {
      const apiError = (error as { response: { data: ApiErrorResponse } }).response.data;
      return new Error(apiError.message || `Failed to ${operation}`);
    }
    if (error instanceof Error) {
      return new Error(`Failed to ${operation}: ${error.message}`);
    }
    return new Error(`Failed to ${operation}`);
  }
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
      throw FilterService.handleError(error, 'get user defined filter failed');
    }
  }

  async createFilter(createFilterDTO: CreateUserFilters): Promise<UserFilters> {
    try {
      const response = await apiClient.post<UserFilters>(
        `${this.baseUrl}/create`,
        createFilterDTO,
      );
      return FilterService.validateFilterResponse(response);
    } catch (error: unknown) {
      // Check for 409 Conflict - duplicate filter
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: unknown }).response === 'object' &&
        (error as { response?: { status?: number } }).response?.status === HTTP_CONFLICT
      ) {
        throw new Error('FILTER_ALREADY_EXISTS', { cause: error });
      }

      throw FilterService.handleError(error, 'create filter');
    }
  }
}

export const filterService = new FilterService();
