export interface Condition {
  id: string | number;
  title: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  severity: 'high' | 'medium' | 'low';
}

export interface EvaluatedTransaction {
  id: string;
  date: string;
  type: string;
  amount: string;
  status: string;
  jurisdiction: string;
  reason: string;
}

export interface ConditionsResponse {
  activeConditions: Condition[];
  evaluatedTransactions: EvaluatedTransaction[];
  earnedConditions: Condition[];
  futureConditions: Condition[];
  metrics: {
    active: number;
    blocked: number;
    approved: number;
    review: number;
  };
}
