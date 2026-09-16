import type { FormattedConditionRecord } from './gold-lakehouse-responses.types';

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
  conditions: FormattedConditionRecord[];
  metadata: ConditionsListMetadata;
}
