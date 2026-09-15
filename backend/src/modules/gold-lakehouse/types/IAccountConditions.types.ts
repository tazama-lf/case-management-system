import type { Condition } from '@tazama-lf/frms-coe-lib';

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
