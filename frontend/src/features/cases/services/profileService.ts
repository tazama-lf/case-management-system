/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Service handles dynamic API response data */
/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances */
import apiClient from '../../../shared/services/apiClient';
import type { GenerateProfileRequest, GenerateProfileResponse } from './types/profile.types';



export class ProfileService {
  private readonly baseUrl = '/api/v1/lakehouse';

  async generateProfile(alertId: number
  ): Promise<GenerateProfileResponse> {

    if (!alertId) {
      return await Promise.reject(new Error('Alert ID is required to generate profile'));
    }

    try {
      const user = localStorage.getItem('user');
      let tenantId = '';
      if (user) {
        try {
          const userData = JSON.parse(user);
          tenantId = userData.tenantId ?? '';
        } catch { }
      }

      if (!tenantId) {
        throw new Error('Tenant ID is required to generate profile');
      }

      const request: GenerateProfileRequest = {
        tenantId,
      };
      const response = await apiClient.post<GenerateProfileResponse>(
        `${this.baseUrl}/profile/generate/${alertId}`,
        { ...request, tenantId },
      );
      return response;
    } catch (error: unknown) {
      throw this.handleError(error, 'generate transaction profile');
    }
  }

  private handleError(error: unknown, operation: string): Error {
    if (error && typeof error === 'object' && 'response' in error) {
      const errorWithResponse = error as { response?: { data?: { message?: string } }; message?: string };
      if (errorWithResponse.response?.data) {
        return new Error(errorWithResponse.response.data.message ?? `Failed to ${operation}`);
      }
      return new Error(`Failed to ${operation}: ${errorWithResponse.message ?? 'Unknown error'}`);
    }
    return new Error(`Failed to ${operation}`);
  }
}

export const profileService = new ProfileService();
/* eslint-enable @typescript-eslint/class-methods-use-this */
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
