import apiClient from './apiClient';
import type { Alert, AlertsFilter, UpdateAlertDto, ConvertToCaseDto, CloseAlertDto } from '../types/triage.types';

class TriageService {
  private baseUrl = '/api/v1/triage/alerts';

  // GET /api/v1/triage/alerts
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
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const queryString = params.toString();
    const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;
    
    return apiClient.get<any>(url);
  }

  // GET /api/v1/triage/alerts/:alertId
  async getAlertById(alertId: string): Promise<Alert> {
    return apiClient.get<Alert>(`${this.baseUrl}/${alertId}`);
  }

  // PATCH /api/v1/triage/alerts/:alertId
  async updateAlert(alertId: string, data: UpdateAlertDto): Promise<Alert> {
    return apiClient.patch<Alert>(`${this.baseUrl}/${alertId}`, data);
  }

  // PATCH /api/v1/triage/alerts/:alertId/close
  async closeAlert(alertId: string, justification: string): Promise<Alert> {
    const data: CloseAlertDto = { reason: justification };
    return apiClient.patch<Alert>(`${this.baseUrl}/${alertId}/close`, data);
  }

  // POST /api/v1/triage/alerts/:alertId/convert-to-case
  async convertAlertToCase(alertId: string, data: ConvertToCaseDto): Promise<any> {
    return apiClient.post<any>(`${this.baseUrl}/${alertId}/convert-to-case`, data);
  }
}

export default new TriageService();