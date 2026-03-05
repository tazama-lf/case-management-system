import apiClient from '@/shared/services/apiClient';
import type { ConditionsTransactionContextResponse } from '../types';

class ConditionsContextByTransactionService {
  private baseUrl = '/api/v1/lakehouse/conditions/by-transaction';

  async getContextByTransaction(
    transactionId: number,
    tenantId: string = 'DEFAULT',
  ): Promise<ConditionsTransactionContextResponse> {
    if (!transactionId || Number.isNaN(transactionId)) {
      throw new Error('Transaction ID is required');
    }

    return apiClient.get<ConditionsTransactionContextResponse>(
      `${this.baseUrl}/${transactionId}?tenantId=${tenantId}`,
    );
  }
}

export default new ConditionsContextByTransactionService();
