import type { Alert } from '@tazama-lf/frms-coe-lib/lib/interfaces/processor-files/Alert';

export interface AlertActions {
  viewAlertNavigator: string;
  viewTransactionDetails: string | null;
}

export interface AlertPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AlertHistoryAlertsResponse {
  alerts: Alert[];
  pagination: AlertPagination;
}
