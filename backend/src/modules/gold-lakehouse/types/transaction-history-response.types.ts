import type { Cumulative, RecentTransaction, Timeline } from './gold-lakehouse.types';

export interface TransactionHistoryResponse {
  summary: {
    totalVolume: number;
    totalTransactions: number;
    transactionCount: number;
    alertsTriggered: number;
    alertsPercentage: number;
    investigated: number;
    investigatedPercentage: number;
    avgTransactionsPerDay: number;
    durationDays: number;
    bucketTotalVolume: number;
    bucketTotalTransactions: number;
    expected: {
      transactionCount: number | null;
      volume: number | null;
    };
    actual: {
      transactionCount: number;
      volume: number;
    };
  };
  timeline: Timeline[];
  cumulative: Cumulative;
  volumeDistribution: Array<{
    bucketStart: string;
    granularity: string;
    transactionCount: number;
    totalVolume: number;
  }>;
  recentTransactions: RecentTransaction[];
  meta: {
    accountId: string;
    tenantId: string;
    granularity: string | null;
    startDate: string | null;
    endDate: string | null;
    eventRowCount: number;
    aggRowCount: number;
    queryTimestamp: string;
  };
}
