export interface TransactionHistorySummary {
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
    transactionCount: number;
    volume: number;
  };
  actual: {
    transactionCount: number;
    volume: number;
  };
}

export interface TimelineItem {
  transactionId: number | string;
  date: string;
  amount: number;
  currency: string;
  type: string;
  isAlerted: boolean;
  isInvestigated: boolean;
}

export interface CumulativeItem {
  date: string;
  cumulativeAmount: number;
  cumulativeCount: number;
}

export interface VolumeDistributionItem {
  date: string;
  value: number;
}

export interface RecentTransactionItem {
  transactionId: number | string;
  date: string;
  type: string;
  counterparty: string;
  amount: number;
  currency: string;
  status: string[];
  actions: {
    viewDetailsLink: string;
  };
}

export interface TransactionHistoryMeta {
  entityId: string;
  tenantId: string;
  granularity: string | null;
  startDate: string;
  endDate: string;
  eventRowCount: number;
  aggRowCount: number;
  queryTimestamp: string;
}

export interface TransactionHistoryResponse {
  summary: TransactionHistorySummary;
  timeline: TimelineItem[];
  cumulative: CumulativeItem[];
  volumeDistribution: VolumeDistributionItem[];
  recentTransactions: RecentTransactionItem[];
  meta: TransactionHistoryMeta;
}
