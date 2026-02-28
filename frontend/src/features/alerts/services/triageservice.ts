import apiClient from '../../../shared/services/apiClient';
import type { Alert } from '../types/alertsdashboard.types';
import type {
  ManualTriageDto,
  UpdateAlertDto,
  CloseAlertDto,
  AlertStatus,
  AlertsFilter,
  ActionHistory,
  TransactionHistoryDto,
} from '../types/triage.types';

class TriageService {
  private readonly baseUrl = '/api/v1/triage/alerts';
  private readonly alertBaseUrl = '/api/v1/alert';

  private handleError(error: unknown, operation: string): Error {
    console.error(`TriageService Error - ${operation}:`, error);

    const err = error as
      | { response?: { data?: { message?: string } }; message?: string }
      | undefined;
    if (err?.response?.data) {
      const apiError = err.response.data;
      return new Error(apiError.message ?? `Failed to ${operation}`);
    }

    if (err?.message) {
      return new Error(err.message);
    }

    return new Error(`Failed to ${operation}`);
  }

  private validateAlertResponse(data: unknown): Alert {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid alert data received');
    }

    const d = data as { alert_id?: unknown };
    if (!d.alert_id) {
      throw new Error('Alert ID is missing from response');
    }

    return data as Alert;
  }

  async getAlerts(filters: AlertsFilter = {}): Promise<{
    alerts: Alert[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      pageSize: number;
    };
  }> {
    const params = new URLSearchParams();

    if (filters.priority) params.append('priority', filters.priority);
    if (filters.type) params.append('type', filters.type);
    if (filters.alertType) params.append('alertType', filters.alertType);
    if (filters.source) params.append('source', filters.source);
    if (filters.search) params.append('search', filters.search);
    params.append('reportStatus', filters.reportStatus ?? 'ALRT');
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    params.append('includeData', 'true');

    const queryString = params.toString();
    const url = queryString
      ? `${this.alertBaseUrl}?${queryString}`
      : this.alertBaseUrl;

    const backendResponse = await apiClient.get<{
      data: Alert[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(url);

    const alerts = backendResponse.data ?? [];

    return {
      alerts,
      pagination: {
        currentPage: backendResponse.page ?? 1,
        totalPages: backendResponse.totalPages ?? 1,
        totalItems: backendResponse.total ?? 0,
        pageSize: backendResponse.limit ?? 10,
      },
    };
  }

  async getFilterOptions(): Promise<{
    priorities: string[];
    statuses: string[];
    alertTypes: string[];
    sources: string[];
  }> {
    try {
      const response = await apiClient.get<{
        priorities: string[];
        statuses: string[];
        alertTypes: string[];
        sources: string[];
      }>(`${this.baseUrl}/filter-options`);
      return response;
    } catch (error) {
      throw this.handleError(error, 'fetch filter options');
    }
  }

  async getAlertById(alertId: number): Promise<Alert> {
    try {
      const response = await apiClient.get<Alert>(
        `${this.alertBaseUrl}/${alertId}`,
      );
      return this.validateAlertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'fetch alert details');
    }
  }

  async getAlertActionHistory(alertId: number): Promise<ActionHistory[]> {
    try {
      const response = await apiClient.get<{ history: ActionHistory[] }>(
        `${this.alertBaseUrl}/${alertId}/action-history`,
      );
      return response.history;
    } catch (error) {
      throw this.handleError(error, 'fetch alert action history');
    }
  }

  async performManualTriage(
    alertId: number,
    data: ManualTriageDto,
  ): Promise<Alert> {
    try {
      const response = await apiClient.patch<Alert>(
        `${this.baseUrl}/${alertId}`,
        data,
      );
      return this.validateAlertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'perform manual triage');
    }
  }

  async updateAlert(alertId: number, data: UpdateAlertDto): Promise<Alert> {
    try {
      const response = await apiClient.patch<Alert>(
        `${this.baseUrl}/${alertId}`,
        data,
      );
      return this.validateAlertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'update alert');
    }
  }

  async closeAlert(
    alertId: number,
    status: AlertStatus,
    notes: string,
  ): Promise<Alert> {
    try {
      const data: CloseAlertDto = { status, reason: notes };
      const response = await apiClient.patch<Alert>(
        `${this.baseUrl}/${alertId}/close`,
        data,
      );
      return this.validateAlertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'close alert');
    }
  }

  async getAlertTransactionalData(alertId: number) {
    try {
      const response = await apiClient.get<TransactionHistoryDto[]>(
        `${this.alertBaseUrl}/${alertId}/transaction-data`,
      );
      return response;
    } catch (error) {
      throw this.handleError(error, 'close alert');
    }
  }

  async getNALTAlerts(
    search?: string,
    pagination?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ): Promise<{
    alerts: Alert[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      pageSize: number;
    };
  }> {
    try {
      const filters: AlertsFilter = {
        reportStatus: 'NALT',
        limit: pagination?.limit ?? 10,
        page: pagination?.page ?? 1,
        sortBy: pagination?.sortBy ?? 'created_at',
        sortOrder: pagination?.sortOrder ?? 'desc',
      };

      if (search) {
        filters.search = search;
      }

      // Call getAlerts, which will use reportStatus=NALT from filters
      const response = await this.getAlerts(filters);
      return response;
    } catch (error) {
      throw this.handleError(error, 'fetch NALT alerts');
    }
  }
}

export default new TriageService();
