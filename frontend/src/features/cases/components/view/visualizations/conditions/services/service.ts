import apiClient from '@/shared/services/apiClient';
import type {
  ConditionsSummaryResponse,
  ActiveCondition,
  ExpiredCondition,
  FutureCondition,
  EvaluatedTransaction,
  ConditionsData,
  DisplayCondition,
  DisplayTransaction,
} from '../types';

class ConditionsService {
  private baseUrl = '/api/v1/lakehouse/conditions';

  /**
   * Fetch comprehensive conditions data for an account
   * This aggregates data from multiple endpoints:
   * - Summary metrics
   * - Active conditions
   * - Expired conditions
   * - Future conditions
   * - Evaluated transactions
   */
  async getConditionsData(
    accountId: string,
    fromDate?: string,
  ): Promise<ConditionsData> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    try {
      // Fetch all data in parallel
      const [summary, active, expired, future, transactions] =
        await Promise.all([
          this.getSummary(accountId, fromDate),
          this.getActive(accountId, fromDate),
          this.getExpired(accountId),
          this.getFuture(accountId),
          this.getEvaluatedTransactions(accountId, fromDate),
        ]);

      // Transform and combine all data
      return {
        activeConditions: this.transformActiveConditions(active),
        expiredConditions: this.transformExpiredConditions(expired),
        futureConditions: this.transformFutureConditions(future),
        evaluatedTransactions: this.transformTransactions(transactions),
        metrics: {
          active: summary.activeConditions,
          blocked: summary.blockedTransactions,
          overridden: summary.overriddenTransactions,
          future: summary.futureConditions,
        },
      };
    } catch (error) {
      console.error('Error fetching conditions data:', error);
      throw error;
    }
  }

  /**
   * Get conditions summary metrics
   */
  async getSummary(
    accountId: string,
    fromDate?: string,
  ): Promise<ConditionsSummaryResponse> {
    const params = new URLSearchParams({ accountId });
    if (fromDate) params.append('fromDate', fromDate);

    return await apiClient.get<ConditionsSummaryResponse>(
      `${this.baseUrl}/summary?${params.toString()}`,
    );
  }

  /**
   * Get active conditions
   */
  async getActive(
    accountId: string,
    fromDate?: string,
  ): Promise<ActiveCondition[]> {
    const params = new URLSearchParams({ accountId });
    if (fromDate) params.append('fromDate', fromDate);

    return await apiClient.get<ActiveCondition[]>(
      `${this.baseUrl}/active?${params.toString()}`,
    );
  }

  /**
   * Get expired conditions
   */
  async getExpired(accountId: string): Promise<ExpiredCondition[]> {
    return await apiClient.get<ExpiredCondition[]>(
      `${this.baseUrl}/expired?accountId=${accountId}`,
    );
  }

  /**
   * Get future conditions
   */
  async getFuture(accountId: string): Promise<FutureCondition[]> {
    return await apiClient.get<FutureCondition[]>(
      `${this.baseUrl}/future?accountId=${accountId}`,
    );
  }

  /**
   * Get evaluated transactions
   */
  async getEvaluatedTransactions(
    accountId: string,
    fromDate?: string,
  ): Promise<EvaluatedTransaction[]> {
    const params = new URLSearchParams({ accountId });
    if (fromDate) params.append('fromDate', fromDate);

    return await apiClient.get<EvaluatedTransaction[]>(
      `${this.baseUrl}/evaluated-transactions?${params.toString()}`,
    );
  }

  // ============= Transform Functions =============

  private transformActiveConditions(
    conditions: ActiveCondition[],
  ): DisplayCondition[] {
    return conditions.map((condition) => ({
      id: condition.conditionId,
      title: condition.title,
      type: condition.action,
      startDate: condition.startDate,
      endDate: condition.endDate,
      status: 'ACTIVE' as const,
      severity:
        condition.action === 'BLOCK' ? ('high' as const) : ('medium' as const),
      createdBy: condition.createdBy,
      notes: condition.notes,
      action: condition.action,
    }));
  }

  private transformExpiredConditions(
    conditions: ExpiredCondition[],
  ): DisplayCondition[] {
    return conditions.map((condition) => ({
      id: condition.conditionId,
      title: condition.title,
      type: 'EXPIRED',
      startDate: condition.startDate,
      endDate: condition.endDate,
      status: 'EXPIRED' as const,
      severity: 'low' as const,
    }));
  }

  private transformFutureConditions(
    conditions: FutureCondition[],
  ): DisplayCondition[] {
    return conditions.map((condition) => ({
      id: condition.conditionId,
      title: condition.title,
      type: 'FUTURE',
      startDate: condition.startDate,
      endDate: null,
      status: 'FUTURE' as const,
      severity: 'medium' as const,
    }));
  }

  private transformTransactions(
    transactions: EvaluatedTransaction[],
  ): DisplayTransaction[] {
    return transactions.map((txn) => ({
      id: txn.transactionId.toString(),
      date: txn.date,
      type: txn.type,
      amount: `${txn.amount.toFixed(2)}`,
      currency: txn.currency,
      status: txn.outcome,
      outcome: txn.outcome,
      conditionId: txn.conditionId,
      reason: txn.reason,
    }));
  }
}

export default new ConditionsService();
