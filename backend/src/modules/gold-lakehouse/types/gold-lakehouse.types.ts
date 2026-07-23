export interface RecentTransaction {
  transactionId: string;
  date: string;
  type: string;
  counterparty: string;
  amount: number;
  currency: string;
  status: string[];
  actions: TransactionAction;
}

interface TransactionAction {
  viewDetailsLink: string;
}

export interface Cumulative {
  date: string;
  cumulativeAmount: number;
  cumulativeCount: number;
}

export interface Timeline {
  transactionId: string;
  date: string;
  amount: number;
  currency: string;
  type: string;
  isAlerted: boolean;
  isInvestigated: boolean;
}

export interface Alerts {
  alertId: number;
  date: string;
  type: string;
  severity: string;
  status: string;
  caseId: number | null;
  outcome: string;
  actions: {
    viewAlertNavigator: string;
    viewTransactionDetails: string | null;
  };
}

export interface Node {
  id: string;
  type: string;
  label: string;
  flags: NodeFlags;
}

export interface NodeFlags {
  alerted: boolean;
  investigated: boolean;
}

export interface Edge {
  source: string;
  target: string;
  txCount: number;
  totalAmount: number;
  currency?: string;
  flags: NodeFlags;
}
