// ============= Backend Response Types =============

export interface ConditionsSummaryResponse {
  activeConditions: number;
  blockedTransactions: number;
  overriddenTransactions: number;
  futureConditions: number;
}

export interface ConditionDetail {
  conditionId: string;
  conditionType: string;
  conditionReason: string;
  createdBy: string;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'FUTURE';
  notes: string;
}

export interface ActiveCondition {
  conditionId: string;
  title: string;
  createdBy: string;
  startDate: string;
  endDate: string | null;
  notes: string;
  action: 'OVERRIDE' | 'BLOCK';
}

export interface ExpiredCondition {
  conditionId: string;
  title: string;
  startDate: string;
  endDate: string;
}

export interface FutureCondition {
  conditionId: string;
  title: string;
  startDate: string;
}

export interface EvaluatedTransaction {
  transactionId: number;
  date: string;
  type: string;
  amount: number;
  currency: string;
  outcome: 'BLOCKED' | 'OVERRIDDEN' | 'PASSED';
  conditionId: string;
  reason: string;
}

// ============= Frontend Display Types =============

export interface DisplayCondition {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'FUTURE';
  severity: 'high' | 'medium' | 'low';
  createdBy?: string;
  notes?: string;
  action?: 'OVERRIDE' | 'BLOCK';
}

export interface DisplayTransaction {
  id: string;
  date: string;
  type: string;
  amount: string;
  currency: string;
  status: 'BLOCKED' | 'OVERRIDDEN' | 'PASSED';
  outcome: 'BLOCKED' | 'OVERRIDDEN' | 'PASSED';
  conditionId: string;
  reason: string;
}

export interface ConditionsData {
  activeConditions: DisplayCondition[];
  expiredConditions: DisplayCondition[];
  futureConditions: DisplayCondition[];
  evaluatedTransactions: DisplayTransaction[];
  metrics: {
    active: number;
    blocked: number;
    overridden: number;
    future: number;
  };
}
