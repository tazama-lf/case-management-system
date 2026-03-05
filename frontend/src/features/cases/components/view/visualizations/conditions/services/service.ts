import apiClient from '@/shared/services/apiClient';
import type {
  ConditionsSummaryResponse,
  ConditionsDetailsResponse,
  ConditionsData,
  ConditionsTransactionContextResponse,
  DisplayCondition,
  DisplayTransaction,
} from '../types';

type EvaluatedTransactionsResponse = {
  transactions?: Array<{
    transactionId: string | number;
    date: string;
    type: string;
    amount: number;
    currency: string;
    outcome: string;
    conditionId: string;
    reason: string;
  }>;
};

class ConditionsService {
  private baseUrl = '/api/v1/lakehouse/conditions';

  async getContextByTransaction(
    transactionId: number,
    tenantId: string = 'DEFAULT',
  ): Promise<ConditionsTransactionContextResponse> {
    if (!transactionId || Number.isNaN(transactionId)) {
      throw new Error('Transaction ID is required');
    }

    return apiClient.get<ConditionsTransactionContextResponse>(
      `${this.baseUrl}/by-transaction/${transactionId}?tenantId=${tenantId}`,
    );
  }

  async getConditionsData(
    accountId: string,
    options?: {
      asOfDate?: string;
      showInactive?: boolean;
      fromDate?: string;
      tenantId?: string;
    },
  ): Promise<ConditionsData> {
    if (!accountId) {
      throw new Error('Account ID is required');
    }

    const asOfDate = options?.asOfDate;
    const showInactive = options?.showInactive ?? false;
    const fromDate = options?.fromDate;
    const tenantId = options?.tenantId || 'DEFAULT';

    const [summaryResult, detailsResult, evaluatedResult] = await Promise.allSettled([
      this.getSummary(accountId, tenantId, asOfDate),
      this.getDetails(accountId, tenantId, asOfDate, showInactive),
      this.getEvaluatedTransactions(accountId, tenantId, fromDate),
    ]);

    if (summaryResult.status === 'rejected') {
      throw summaryResult.reason;
    }

    if (detailsResult.status === 'rejected') {
      throw detailsResult.reason;
    }

    const summary = summaryResult.value;
    const details = detailsResult.value;
    const evaluated: EvaluatedTransactionsResponse =
      evaluatedResult.status === 'fulfilled' ? evaluatedResult.value : { transactions: [] };

    const transformed = this.transformDetails(details);

    return {
      activeConditions: transformed.active,
      expiredConditions: transformed.expired,
      futureConditions: transformed.future,
      evaluatedTransactions: this.transformTransactions(evaluated),
      metrics: {
        active: summary.activeConditions,
        blocked: transformed.blockedCount,
        overridden: transformed.overriddenCount,
        future: summary.futureConditions,
      },
    };
  }

  async getSummary(
    accountId: string,
    tenantId: string = 'DEFAULT',
    asOfDate?: string,
  ): Promise<ConditionsSummaryResponse> {
    const params = new URLSearchParams({ accountId, tenantId });
    if (asOfDate) params.append('asOfDate', asOfDate);

    return apiClient.get<ConditionsSummaryResponse>(`${this.baseUrl}/summary?${params.toString()}`);
  }

  async getDetails(
    accountId: string,
    tenantId: string = 'DEFAULT',
    asOfDate?: string,
    showInactive: boolean = false,
  ): Promise<ConditionsDetailsResponse> {
    const params = new URLSearchParams({ accountId, tenantId });
    if (asOfDate) params.append('asOfDate', asOfDate);
    if (showInactive) params.append('showInactive', 'true');

    return apiClient.get<ConditionsDetailsResponse>(`${this.baseUrl}/details?${params.toString()}`);
  }

  async getEvaluatedTransactions(
    accountId: string,
    tenantId: string = 'DEFAULT',
    fromDate?: string,
  ): Promise<EvaluatedTransactionsResponse> {
    const params = new URLSearchParams({ tenantId });
    if (fromDate) params.append('fromDate', fromDate);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<EvaluatedTransactionsResponse>(
      `${this.baseUrl}/evaluated-transactions/${accountId}${suffix}`,
    );
  }

  private transformDetails(details: ConditionsDetailsResponse): {
    active: DisplayCondition[];
    expired: DisplayCondition[];
    future: DisplayCondition[];
    blockedCount: number;
    overriddenCount: number;
  } {
    const active: DisplayCondition[] = [];
    const expired: DisplayCondition[] = [];
    const future: DisplayCondition[] = [];
    let blockedCount = 0;
    let overriddenCount = 0;

    for (const r of details.conditions || []) {
      const status: DisplayCondition['status'] =
        r.status === 'expired' || r.isExpired
          ? 'EXPIRED'
          : r.status === 'future'
            ? 'FUTURE'
            : 'ACTIVE';

      const action: 'OVERRIDE' | 'BLOCK' =
        r.type && r.type.toLowerCase().includes('block') ? 'BLOCK' : 'OVERRIDE';

      if (status === 'ACTIVE') {
        if (action === 'BLOCK') blockedCount += 1;
        if (action === 'OVERRIDE') overriddenCount += 1;
      }

      const item: DisplayCondition = {
        id: r.conditionId,
        title: r.reason || r.conditionId,
        type: r.type,
        startDate: r.inceptionTimestamp || r.inceptionDate || '',
        endDate: r.expiryTimestamp ?? r.expiryDate ?? null,
        status,
        severity: action === 'BLOCK' ? 'high' : status === 'FUTURE' ? 'medium' : 'low',
        createdBy: r.createdBy,
        notes: r.reason,
        action,
      };

      if (status === 'ACTIVE') active.push(item);
      else if (status === 'EXPIRED') expired.push(item);
      else future.push(item);
    }

    return { active, expired, future, blockedCount, overriddenCount };
  }

  private transformTransactions(evaluated: EvaluatedTransactionsResponse): DisplayTransaction[] {
    const raw = Array.isArray((evaluated as any)?.transactions)
      ? ((evaluated as any).transactions as EvaluatedTransactionsResponse['transactions'])
      : [];

    return (raw || []).map((txn) => ({
      id: String(txn.transactionId),
      date: txn.date,
      type: txn.type,
      amount: `${Number(txn.amount || 0).toFixed(2)}`,
      currency: txn.currency,
      status: 'BLOCKED',
      outcome: 'BLOCKED',
      conditionId: txn.conditionId,
      reason: txn.reason,
    }));
  }
}

export default new ConditionsService();
