/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Service handles dynamic API response data */
import apiClient from '../../../../../../../shared/services/apiClient';
import type { AlertNavigatorDto } from '../types';

class AlertNavigatorService {
  private readonly baseUrl = '/api/v1/lakehouse/alert-navigator';

  async getAlertNavigator(
    alertId: number,
    tenantId = 'DEFAULT',
  ): Promise<AlertNavigatorDto> {
    const response = await apiClient.get<any>(
      `${this.baseUrl}/${alertId}?tenantId=${tenantId}`,
    );

    // Parse the rules from JSON string to array
    const parsedData: AlertNavigatorDto = {
      ...response,
      typologies:
        response.typologies?.map((typology: any) => ({
          ...typology,
          rules:
            typeof typology.rules === 'string'
              ? JSON.parse(typology.rules)
              : typology.rules ?? [],
        })) ?? [],
    };
    return parsedData;
  }
}

export default new AlertNavigatorService();
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
