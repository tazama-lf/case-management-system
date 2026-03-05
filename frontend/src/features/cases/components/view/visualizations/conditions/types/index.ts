// ============= Backend Response Types =============

export interface ConditionsSummaryResponse {
  accountId: string;
  accountScheme?: string;
  fspId?: string;
  totalConditions: number;
  activeConditions: number;
  expiredConditions: number;
  futureConditions: number;
  conditions?: Array<{
    conditionId: string;
    type: string;
    reason: string;
    status: string;
    inceptionDate?: string;
    expiryDate?: string | null;
    createdBy?: string;
  }>;
  metadata?: {
    asOfDate?: string;
    queryTimestamp?: string;
  };
}

export interface ConditionsDetailsRecord {
  conditionId: string;
  type: string;
  perspective?: string;
  reason: string;
  createdBy?: string;
  inceptionTimestamp?: string;
  expiryTimestamp?: string | null;
  inceptionDate?: string;
  expiryDate?: string | null;
  isActive: boolean;
  isExpired: boolean;
  status?: 'active' | 'expired' | 'future' | string;
}

export interface ConditionsDetailsResponse {
  accountId: string;
  totalConditions: number;
  conditions: ConditionsDetailsRecord[];
  metadata?: {
    activeCount?: number;
    expiredCount?: number;
    futureCount?: number;
    asOfDate?: string;
    showInactive?: boolean;
    queryTimestamp?: string;
  };
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

export interface ConditionsTransactionContextAccount {
  accountId: string;
  accountNumber: string;
  accountType: string;
  isTransactionAccount: boolean;
  activeConditionsCount: number;
  expiredConditionsCount: number;
  futureConditionsCount: number;
}

export interface ConditionsTransactionContextParty {
  entityId: string;
  entityName: string;
  primaryAccountId: string;
  accounts: ConditionsTransactionContextAccount[];
}

export interface ConditionsTransactionContextTransaction {
  transactionId: number;
  displayId: string;
  endToEndId: string;
  timestamp: string;
  type: string;
  amount: number;
  currency: string;
}

export interface ConditionsTransactionContextMetadata {
  asOfDate: string;
  queryTimestamp: string;
}

export interface ConditionsTransactionContextResponse {
  transaction: ConditionsTransactionContextTransaction;
  debtor: ConditionsTransactionContextParty;
  creditor: ConditionsTransactionContextParty;
  metadata: ConditionsTransactionContextMetadata;
}
