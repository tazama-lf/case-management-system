import apiClient from '../../../../../../../shared/services/apiClient';
import type { AlertNavigatorDto } from '../types';

class AlertNavigatorService {
  private baseUrl = '/api/v1/lakehouse/alert-navigator';

  async getAlertNavigator(alertId: number, tenantId: string): Promise<AlertNavigatorDto> {
    const response = await apiClient.get<any>(
      `${this.baseUrl}/${alertId}?tenantId=${tenantId}`,
    );

    // Parse the rules from JSON string to array
    const parsedData: AlertNavigatorDto = {
      ...response,
      typologies: response.typologies?.map((typology: any) => ({
        ...typology,
        rules: typeof typology.rules === 'string'
          ? JSON.parse(typology.rules)
          : typology.rules || [],
      })) || [],
    };
    return parsedData;
  }
}

export default new AlertNavigatorService();
