export interface AlertCountOverTime {
  date: string;
  alerts: number;
  cases: number;
  investigations: number;
}

export interface AlertValueOverTime {
  date: string;
  totalValue: number;
}

export interface AlertHistoryTimelineResponse {
  alertCountOverTime: AlertCountOverTime[];
  alertValueOverTime: AlertValueOverTime[];
}
