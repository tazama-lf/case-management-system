export interface BenfordAnalysisResponse {
  expected: Record<number, number>;
  actual: Record<number, number>;
  sampleSize: number;
  meta: {
    accountId: string;
    tenantId: string;
    fromDate: string;
    toDate: string;
  };
}
