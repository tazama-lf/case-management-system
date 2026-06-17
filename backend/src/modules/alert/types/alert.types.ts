interface RuleResult {
  id: string;
  cfg: string;
  wght: number;
  prcgTm: number;
  tenantId: string;
  subRuleRef: string;
  indpdntVarbl: number;
}

export interface AlertedTypology {
  id: string;
  cfg: string;
  result: number;
  alertThreshold: number;
  interdictionThreshold: number;
  ruleResults: RuleResult[];
}