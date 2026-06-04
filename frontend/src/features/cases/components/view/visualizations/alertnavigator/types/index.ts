export interface RuleDetailDto {
  ruleId: string;
  ruleWeight: number;
  subRef?: string;
  independentVariable?: string;
}

export interface TypologyDto {
  typologyId: string;
  typologyCfg: string;
  typologyScore: number;
  alertThreshold: number;
  interdictionThreshold: number;
  ruleCount: number;
  rules: RuleDetailDto[]; // Parsed from JSON string
}

export interface AlertNavigatorDto {
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
  typologies: TypologyDto[];
  statistics: {
    totalTypologies: number;
    totalRules: number;
  };
  meta: {
    alertId: number;
    tenantId: string;
  };
}
