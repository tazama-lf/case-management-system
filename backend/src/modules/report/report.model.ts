export enum FraudReportOutcome {
  CONFIRMED_FRAUD = 'Confirmed Fraud',
  REFUTED_FRAUD = 'Refuted Fraud',
  UNDER_MONITORING = 'Under Monitoring',
}

export interface FraudReport {
  reportId: string;
  caseId: number;
  reportType: string;
  metadata: [
    caseType: string,
    investigator: string,
    supervisor: string,
    submittedAt: string,
    approvedAt?: string,
    fileName?: string,
    fileSize?: number,
    filePath?: string,
    mimeType?: string,
    hash?: string,
    encryption?: {
      key: string;
      iv: string;
      authTag: string;
    },
  ];
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
