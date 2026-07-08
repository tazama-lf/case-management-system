export interface RuleDetailDto {
  ruleId: string;
  ruleWeight: number;
  subRef?: string;
  independentVariable?: string;
  data?: unknown;
  ruleDesc?: string;
  band_reasons_with_sub_rule_refs_json?: string[];
  matched_band_reason?: string | null;
  exit_condition_reasons_json?: string[];
  matched_exit_condition_reason?: string | null;
  matched_rule_reason?: string | null;
  band_count?: number | null;
  exit_condition_count?: number | null;
}

export interface TypologyDto {
  typologyId: string;
  typologyCfg: string;
  typologyScore: number;
  alertThreshold: number;
  interdictionThreshold: number;
  ruleCount: number;
  flowProcessorData?: string;
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
