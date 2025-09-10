import apiClient from './apiClient';

export type TriageType = 'AI' | 'MANUAL' | 'DISABLED';

export interface SystemConfig {
  triageType: TriageType;
  confidenceThreshold: number;
  interdictionEnabled: boolean;
}

class SystemConfigService {
  private baseUrl = '/api/v1/config';

  async getSystemConfig(): Promise<SystemConfig> {
    try {
      const response = await apiClient.get<SystemConfig>(`${this.baseUrl}/system`);
      return response;
    } catch (error) {
      console.error('Failed to fetch system config:', error);
      // Fallback to default configuration
      return {
        triageType: 'MANUAL',
        confidenceThreshold: 95,
        interdictionEnabled: true,
      };
    }
  }
}

export default new SystemConfigService();
