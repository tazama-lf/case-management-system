export interface AgeingSummary {
  status: string;
  age0to7: number;
  age8to15: number;
  age16to30: number;
  age30Plus: number;
}

export interface resolutionTrend {
  month: string;
  avgDays: number;
}

export interface monthlyTrend {
  month: string;
  casesCreated: number;
  casesClosed: number;
}

export interface statusDetails {
  status: string;
  count: number;
  percentage: string;
  avgTimeInStatus: string;
  currentTrendPeriod: string;
}
