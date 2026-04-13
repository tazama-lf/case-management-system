import type { Condition } from '@tazama-lf/frms-coe-lib';
export interface AccountConditionsSummary {
  accountId: string;
  accountScheme: string;
  fspId: string;
  totalConditions: number;
  activeConditions: number;
  expiredConditions: number;
  futureConditions: number;
  conditions: Condition[];
  metadata: AccountConditionsMetadata;
}

export interface AccountConditionsMetadata {
  asOfDate: string;
  queryTimestamp: string;
}

export interface ConditionsListMetadata {
  activeCount: number;
  expiredCount: number;
  futureCount: number;
  asOfDate: string;
  showInactive: boolean;
  queryTimestamp: string;
}

export interface ConditionsListByAccountResponse {
  accountId: string;
  totalConditions: number;
  conditions: Condition[];
  metadata: ConditionsListMetadata;
}
