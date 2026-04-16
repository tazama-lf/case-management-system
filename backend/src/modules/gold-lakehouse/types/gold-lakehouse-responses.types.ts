// // Condition Item
export interface ConditionItem {
  conditionId: string;
  conditionType: string;
  accountId: string;
  reason: string;
  inceptionDate: string;
  expiryDate: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface FutureConditionsResponse {
  conditions: Array<{
    conditionId: string;
    title: string;
    type: string;
    startDate: string;
    endDate: string;
    accountId: string;
    transactions: unknown[];
  }>;
  metadata: {
    queriedBy: string;
    accountCount: number;
    accounts?: string[];
    isEntityLevel?: boolean;
  };
}

// Evaluated Transactions Response
export interface EvaluatedTransactionsResponse {
  transactions:
    | {
        transactionId: number;
        date: string;
        type: string;
        amount: number;
        currency: string;
        outcome: string;
        conditionId: string;
        conditionType: string;
        reason: string;

        conditionPeriod: {
          start: string;
          end: string;
        };
        accountRole: string;
        accountId: string;
      }
    | [];
  metadata: {
    accountId: string;
    totalRecords?: number;
    status: string;
    joinMethod?: string;
    message?: string;
    queryTimestamp: string;
  };
}

// Transaction History By End To End ID Response
export interface TransactionHistoryByEndToEndIdResponse {
  summary: {
    totalVolume: number;
    totalTransactions: number;
    transactionCount: number;
    alertsTriggered: number;
    alertsPercentage: number;
    investigated: number;
    investigatedPercentage: number;
    avgTransactionsPerDay: number;
    durationDays: number;
    perspectiveCount?: number;
  };
  timeline: Array<{
    transactionId: number;
    date: string;
    amount: number;
    currency: string;
    type: string;
    isAlerted: boolean;
    isInvestigated: boolean;
  }>;
  cumulative: Array<{
    date: string;
    cumulativeAmount: number;
    cumulativeCount: number;
  }>;
  volumeDistribution: unknown[];
  recentTransactions: Array<{
    transactionId: number;
    date: string;
    entityType: string;
    entityRole: string;
    amount: number;
    currency: string;
    counterparty: string;
    status: string[];
    actions: {
      viewDetailsLink: string;
    };
  }>;
  entityPerspectives: Array<{
    entity_type: string;
    entity_role: string;
    entity_id: string;
    entity_name: string;
    transaction_id: number;
    tx_amount: number;
    tx_ccy: string;
    event_ts: string;
  }>;
  meta: {
    endToEndId: string;
    tenantId: string;
    queryType: string;
    transactionId?: number;
    perspectiveCount?: number;
    debtorName?: string;
    creditorName?: string;
    debtorAccountId?: string;
    creditorAccountId?: string;
    startDate?: string | null;
    endDate?: string | null;
    queryTimestamp: string;
    message?: string;
  };
}

// Network Node
export interface NetworkNode {
  id: string;
  type: string;
  label: string;
  flags: {
    alerted: boolean;
    investigated: boolean;
  };
}

// Network Edge
export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  transactionCount: number;
  totalValue: number;
  currency?: string;
}

// Account Node Full Data Response
export interface AccountNodeFullDataResponse {
  network: {
    rootNodeId: string;
    nodes: NetworkNode[];
    edges: NetworkEdge[];
  };
  accountDetails: {
    accountId: string;
    accountHolder: string;
    relationship: string;
    transactions: number;
    totalValue: number;
    velocity: 'HIGH' | 'MEDIUM' | 'LOW';
    flags: {
      alerted: boolean;
      investigated: boolean;
    };
  };
  meta: {
    tenantId: string;
    granularity: string;
    generatedAt: string;
  };
}

// Counterparty Node Full Data Response
export interface CounterpartyNodeFullDataResponse {
  network: {
    rootNodeId: string;
    nodes: NetworkNode[];
    edges: NetworkEdge[];
  };
  counterpartyDetails: {
    counterpartyId: string;
    name: string;
    type: string;
    transactions: number;
    totalValue: number;
    velocity: 'HIGH' | 'MEDIUM' | 'LOW';
    flags: {
      alerted: boolean;
      investigated: boolean;
    };
  };
  meta: {
    tenantId: string;
    granularity: string;
    generatedAt: string;
  };
}

// Entity Accounts With Condition Counts
export interface EntityAccountWithConditionCounts {
  accountId: string;
  accountNumber: string;
  accountType: string;
  isTransactionAccount: boolean;
  activeConditionsCount: number;
  expiredConditionsCount: number;
  futureConditionsCount: number;
}

// Conditions Context By Transaction Response
export interface ConditionsContextByTransactionResponse {
  transaction: {
    transactionId: number;
    displayId: string;
    endToEndId: string;
    timestamp: string;
    type: string;
    amount: number;
    currency: string;
  };
  debtor: {
    entityId: string;
    entityName: string;
    primaryAccountId: string;
    accounts: EntityAccountWithConditionCounts[];
  };
  creditor: {
    entityId: string;
    entityName: string;
    primaryAccountId: string;
    accounts: EntityAccountWithConditionCounts[];
  };
  metadata: {
    asOfDate: string;
    queryTimestamp: string;
  };
}

// Conditions By Entity Response
export interface ConditionsByEntityResponse {
  entityId: string;
  accounts: Array<{
    accountId: string;
    accountNumber: string;
    accountType: string;
    activeConditions: ConditionItem[];
    expiredConditions: ConditionItem[];
    futureConditions: ConditionItem[];
  }>;
  conditions: ConditionItem[];
  metadata: {
    entityId?: string;
    accountCount?: number;
    totalConditions?: number;
    asOfDate?: string;
    showInactive?: boolean;
    message?: string;
    queryTimestamp: string;
  };
}
