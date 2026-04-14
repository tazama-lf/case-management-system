import apiClient from '@/shared/services/apiClient';
import type { TransactionDetailsDto } from '../types/types';

class TransactionDetailsService {
  private readonly baseUrl = '/api/v1/lakehouse/transaction-detail';

  async getTransactionDetails(
    transactionId: string,
    tenantId = 'DEFAULT',
  ): Promise<TransactionDetailsDto> {
    if (!transactionId) {
      throw new Error('Transaction ID is required');
    }
    const response = await apiClient.get<TransactionDetailsDto>(
      `${this.baseUrl}/${transactionId}?tenantId=${tenantId}`,
    );
    return response;
  }
}

export default new TransactionDetailsService();
