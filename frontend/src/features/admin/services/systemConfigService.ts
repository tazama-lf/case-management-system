import apiClient from '../../../shared/services/apiClient';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';

export interface SystemConfig {
  triageType: 'AI' | 'MANUAL' | 'DISABLED';
  confidenceThreshold: number;
  interdictionEnabled: boolean;
}

export interface SystemConfigResponse {
  triageType: 'AI' | 'MANUAL' | 'DISABLED';
  confidenceThreshold: number;
  interdictionEnabled: boolean;
}

export class SystemConfigService {
  private baseUrl = '/api/v1/config';


  async getSystemConfig(): Promise<SystemConfig> {
    try {
      const response = await apiClient.get<SystemConfigResponse>(`${this.baseUrl}/system`);
      return response;
    } catch (error: any) {
      console.error('Failed to fetch system configuration:', error);

      if (error.response?.data) {
        const apiError = error.response.data as ApiErrorResponse;
        throw new Error(apiError.message || 'Failed to fetch system configuration');
      }

      throw new Error('Failed to fetch system configuration');
    }
  }


  async updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
    try {
      const response = await apiClient.put<SystemConfigResponse>(`${this.baseUrl}/system`, config);
      return response;
    } catch (error: any) {
      console.error('Failed to update system configuration:', error);

      if (error.response?.data) {
        const apiError = error.response.data as ApiErrorResponse;
        throw new Error(apiError.message || 'Failed to update system configuration');
      }

      throw new Error('Failed to update system configuration');
    }
  }


  validateConfig(config: Partial<SystemConfig>): string[] {
    const errors: string[] = [];

    if (config.triageType && !['AI', 'MANUAL', 'DISABLED'].includes(config.triageType)) {
      errors.push('Triage type must be AI, MANUAL, or DISABLED');
    }

    if (config.confidenceThreshold !== undefined) {
      if (config.confidenceThreshold < 0 || config.confidenceThreshold > 100) {
        errors.push('Confidence threshold must be between 0 and 100');
      }
    }

    return errors;
  }
}

export const systemConfigService = new SystemConfigService();