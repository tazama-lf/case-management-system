import apiClient from '../../../../../../../shared/services/apiClient';
import type { AlertNavigatorDto, TypologyDto, RuleDetailDto } from '../types';

// API response type where rules can be a JSON string
interface AlertNavigatorApiResponse extends Omit<AlertNavigatorDto, 'typologies'> {
  typologies: Array<Omit<TypologyDto, 'rules'> & { rules: string | RuleDetailDto[] }>;
}

class AlertNavigatorService {
  private readonly baseUrl = '/api/v1/lakehouse/alert-navigator';

  async getAlertNavigator(alertId: number, tenantId: string): Promise<AlertNavigatorDto> {
    const response = await apiClient.get<AlertNavigatorApiResponse>(
      `${this.baseUrl}/${alertId}?tenantId=${tenantId}`,
    );

    // Parse the rules from JSON string to array
    const parsedData: AlertNavigatorDto = {
      ...response,
      typologies: response.typologies.map((typology) => ({
        ...typology,
        rules: typeof typology.rules === 'string'
          ? (JSON.parse(typology.rules) as RuleDetailDto[])
          : typology.rules,
      })),
    };
    return parsedData;
  }
}

export default new AlertNavigatorService();
