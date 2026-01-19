import apiClient from '@/shared/services/apiClient';
import type { ConditionsResponse } from '../types';

class ConditionsService {
  private baseUrl = '/api/v1/lakehouse/conditions';

  async getConditions(
    id: string,
    tenantId: string = 'DEFAULT',
  ): Promise<ConditionsResponse> {
    if (!id) {
      throw new Error('ID is required');
    }

    const response = await apiClient.get<ConditionsResponse>(
      `${this.baseUrl}/${id}?tenantId=${tenantId}`,
    );
    return response;
  }
}

export default new ConditionsService();
