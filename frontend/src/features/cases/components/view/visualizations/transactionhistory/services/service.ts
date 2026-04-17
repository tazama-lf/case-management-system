import apiClient from '@/shared/services/apiClient';
import type { TransactionHistoryResponse } from '../types';

class TransactionHistoryService {
  private baseUrl = '/api/v1/lakehouse/transaction-history';

  async getTransactionHistory(
    entityId: string,
    tenantId: string = 'DEFAULT',
  ): Promise<TransactionHistoryResponse> {
    if (!entityId) {
      throw new Error('Entity ID is required');
    }

    const response = await apiClient.get<TransactionHistoryResponse>(
      `${this.baseUrl}/${entityId}?tenantId=${tenantId}`,
    );
    return response;
  }
}

export default new TransactionHistoryService();
