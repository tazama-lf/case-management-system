import apiClient from './apiClient';
import type { Alert, AlertsFilter, UpdateAlertDto, ConvertToCaseDto, CloseAlertDto, ConvertToCaseResponse, ApiErrorResponse } from '../types/triage.types';

class TriageService {
  private baseUrl = '/api/v1/triage/alerts';

  // Error handling utility
  private handleError(error: any, operation: string): Error {
    console.error(`TriageService Error - ${operation}:`, error);
    
    if (error.response?.data) {
      const apiError = error.response.data as ApiErrorResponse;
      return new Error(apiError.message || `Failed to ${operation}`);
    }
    
    if (error.message) {
      return new Error(error.message);
    }
    
    return new Error(`Failed to ${operation}`);
  }

  // Response validation utility
  private validateAlertResponse(data: any): Alert {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid alert data received');
    }
    
    if (!data.alert_id) {
      throw new Error('Alert ID is missing from response');
    }
    
    return data as Alert;
  }

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
    
    // Get the raw backend response
    const backendResponse = await apiClient.get<{
      data: Alert[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(url);
    
    // Transform to expected frontend format
    return {
      alerts: backendResponse.data || [],
      pagination: {
        currentPage: backendResponse.page || 1,
        totalPages: backendResponse.totalPages || 1,
        totalItems: backendResponse.total || 0,
        pageSize: backendResponse.limit || 10
      }
    };
  }

  // GET /api/v1/triage/alerts/:alertId
  async getAlertById(alertId: string): Promise<Alert> {
    try {
      const response = await apiClient.get<Alert>(`${this.baseUrl}/${alertId}`);
      return this.validateAlertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'fetch alert details');
    }
  }

  // PATCH /api/v1/triage/alerts/:alertId
  async updateAlert(alertId: string, data: UpdateAlertDto): Promise<Alert> {
    try {
      const response = await apiClient.patch<Alert>(`${this.baseUrl}/${alertId}`, data);
      return this.validateAlertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'update alert');
    }
  }

  // PATCH /api/v1/triage/alerts/:alertId/close
  async closeAlert(alertId: string, justification: string): Promise<Alert> {
    try {
      const data: CloseAlertDto = { reason: justification };
      const response = await apiClient.patch<Alert>(`${this.baseUrl}/${alertId}/close`, data);
      return this.validateAlertResponse(response);
    } catch (error) {
      throw this.handleError(error, 'close alert');
    }
  }

  // POST /api/v1/triage/alerts/:alertId/convert-to-case
  async convertAlertToCase(alertId: string, data: ConvertToCaseDto): Promise<ConvertToCaseResponse> {
    try {
      const response = await apiClient.post<ConvertToCaseResponse>(`${this.baseUrl}/${alertId}/convert-to-case`, data);
      
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response from convert to case operation');
      }
      
      return response;
    } catch (error) {
      throw this.handleError(error, 'convert alert to case');
    }
  }
}

export default new TriageService();