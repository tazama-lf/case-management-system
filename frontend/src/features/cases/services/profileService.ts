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
      const err = error as { response?: { data?: { message?: string } } };
      if (err.response?.data) {
        return new Error(err.response.data.message ?? `Failed to ${operation}`);
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Error(`Failed to ${operation}: ${message}`);
  }
}

export const profileService = new ProfileService();
