export interface AgeingSummary {
  status: string;
  age0to7: number;
  age8to15: number;
  age16to30: number;
  age30Plus: number;
}

export interface resolutionTrend {
  /** calendar-month bucket, e.g. "2026-06" */
  month: string;
  /** count of cases closed in this bucket */
  n: number;
  /** median days-to-close; null when no cases closed that month (renders as a gap) */
  median: number | null;
  /** 25th percentile days-to-close; null when no cases closed that month */
  p25: number | null;
  /** 75th percentile days-to-close; null when no cases closed that month */
  p75: number | null;
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
