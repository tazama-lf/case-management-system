import apiClient from '@/shared/services/apiClient';
import type { TransactionDetailsDto } from '../types/types';

class TransactionDetailsService {
  async getTransactionDetails(transactionId: string): Promise<TransactionDetailsDto> {
    if (!transactionId) {
      throw new Error('Transaction ID is required');
    }
    const baseUrl = '/api/v1/triage/alerts/transactions';
    const response = await apiClient.get<TransactionDetailsDto>(`${baseUrl}/${transactionId}`);
    return response;
  }
}

export default new TransactionDetailsService();
