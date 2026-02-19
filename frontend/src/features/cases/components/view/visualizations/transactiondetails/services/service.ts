import apiClient from '@/shared/services/apiClient';
import type { TransactionDetailsDto } from '../types/types';

class TransactionDetailsService {
  private baseUrl = '/api/v1/lakehouse/transaction-detail';
  private readonly availableTransactionIds = [5, 30, 49, 68];

  private getRandomTransactionId(): number {
    const randomIndex = Math.floor(Math.random() * this.availableTransactionIds.length);
    return this.availableTransactionIds[randomIndex];
  }

  async getTransactionDetails(transactionId: string, tenantId: string = 'DEFAULT'): Promise<TransactionDetailsDto> {
    if (!transactionId) {
      throw new Error('Transaction ID is required');
    }

    // Use random transaction ID from the available pool
    const randomTransactionId = this.getRandomTransactionId();
    console.log(`Using randomized transaction ID: ${randomTransactionId} (original: ${transactionId})`);

    const response = await apiClient.get<TransactionDetailsDto>(
      `${this.baseUrl}/${randomTransactionId}?tenantId=${tenantId}`,
    );
    return response;
  }
}

export default new TransactionDetailsService();
