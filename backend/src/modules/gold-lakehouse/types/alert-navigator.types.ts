export interface AlertNavigatorMetricsResponse {
  total_typologies: number;
  total_rules: number;
  avg_typology_score: number | null;
  alertId: number;
  tenantId: string;
}

export interface AlertNavigatorDataResponse {
  alertMetadata: {
    alertId: number;
    transactionId: string;
    timestamp: string;
    transactionType: string;
    amount: number;
    currency: string;
    status: string;
    reason: string;
    blockReason: string;
    evaluationId: string;
  };
  typologies: Array<{
    typologyId: string;
    typologyCfg: string;
    typologyScore: number;
    alertThreshold: number;
    interdictionThreshold: number;
    ruleCount: number;
    rules: string;
  }>;
  statistics: {
    totalTypologies: number;
    totalRules: number;
  };
  meta: {
    alertId: number;
    tenantId: string;
  };
}
