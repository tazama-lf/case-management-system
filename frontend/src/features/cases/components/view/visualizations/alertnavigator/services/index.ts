import apiClient from '../../../../../../../shared/services/apiClient';
import type { AlertNavigatorDto } from '../types';

class AlertNavigatorService {
  private baseUrl = '/api/v1/triage/alerts';

  async getAlertNavigator(alertId: string): Promise<AlertNavigatorDto> {
    try {
      const response = await apiClient.get<AlertNavigatorDto>(
        `${this.baseUrl}/${alertId}/navigator`,
      );
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch alert navigator';
      console.error('AlertNavigatorService Error:', message);
      throw new Error(message);
    }
  }
}

export default new AlertNavigatorService();
