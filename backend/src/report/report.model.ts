export enum FraudReportOutcome {
  CONFIRMED_FRAUD = 'Confirmed Fraud',
  REFUTED_FRAUD = 'Refuted Fraud',
  UNDER_MONITORING = 'Under Monitoring',
}

export interface FraudReport {
  reportId: string;
  caseId: string;
  metadata: {
    caseType: string;
    investigator: string;
    supervisor: string;
    submittedAt: string;
    approvedAt?: string;
  };
  keyFindings: string;
  evidenceSummary: any[];
  decisions: FraudReportOutcome;
  investigatorInputs: string;
  supervisorRemarks: string;
  recommendations: string;
  archived: boolean;
  version: number;
  history: FraudReport[];
  category: string;
}
