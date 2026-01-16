import apiClient from '../../../../../../../shared/services/apiClient';
import type { AlertNavigatorDto } from '../types';

class AlertNavigatorService {
  private baseUrl = '/api/v1/lakehouse/alert-navigator';
  private readonly availableAlertIds = [433, 389, 417, 394, 444];

  private getRandomAlertId(): number {
    const randomIndex = Math.floor(Math.random() * this.availableAlertIds.length);
    return this.availableAlertIds[randomIndex];
  }

  async getAlertNavigator(alertId: string, tenantId: string = 'DEFAULT'): Promise<AlertNavigatorDto> {
    try {
      // Use random alert ID from the available pool
      const randomAlertId = this.getRandomAlertId();
      console.log(`Using randomized alert ID: ${randomAlertId} (original: ${alertId})`);
      
      const response = await apiClient.get<AlertNavigatorDto>(
        `${this.baseUrl}/${randomAlertId}?tenantId=${tenantId}`,
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
