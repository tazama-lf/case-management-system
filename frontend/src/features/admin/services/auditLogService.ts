import apiClient from '../../../shared/services/apiClient';
import authService from '../../auth/services/authService';
import type { ApiErrorResponse } from '../../alerts/types/triage.types';

export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'PENDING';
  timestamp: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  resource?: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PENDING';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AuditLogService {
  private baseUrl = '/auth';

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `${this.baseUrl}/audit-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get<AuditLogResponse>(endpoint);
      return response;
    } catch (error: any) {
      console.error('Failed to fetch audit logs:', error);
      
      if (error.response?.data) {
        const apiError = error.response.data as ApiErrorResponse;
        throw new Error(apiError.message || 'Failed to fetch audit logs');
      }
      
      throw new Error('Failed to fetch audit logs');
    }
  }

  /**
   * Get audit log entry by ID
   */
  async getAuditLogById(id: string): Promise<AuditLogEntry> {
    try {
      const response = await apiClient.get<AuditLogEntry>(`${this.baseUrl}/audit-logs/${id}`);
      return response;
    } catch (error: any) {
      console.error('Failed to fetch audit log entry:', error);
      
      if (error.response?.data) {
        const apiError = error.response.data as ApiErrorResponse;
        throw new Error(apiError.message || 'Failed to fetch audit log entry');
      }
      
      throw new Error('Failed to fetch audit log entry');
    }
  }

  /**
   * Export audit logs (for compliance)
   */
  async exportAuditLogs(filters: AuditLogFilters = {}): Promise<Blob> {
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `${this.baseUrl}/audit-logs/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      // Note: This would need to be implemented in the backend
      const response = await fetch(endpoint, {
        headers: {
          ...authService.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      return response.blob();
    } catch (error: any) {
      console.error('Failed to export audit logs:', error);
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Format audit log action for display
   */
  formatAction(action: string): string {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Format audit log outcome for display
   */
  formatOutcome(outcome: string): string {
    switch (outcome) {
      case 'SUCCESS':
        return 'Success';
      case 'FAILURE':
        return 'Failure';
      case 'PENDING':
        return 'Pending';
      default:
        return outcome;
    }
  }

  /**
   * Get outcome color class for UI
   */
  getOutcomeColorClass(outcome: string): string {
    switch (outcome) {
      case 'SUCCESS':
        return 'text-green-600 bg-green-100';
      case 'FAILURE':
        return 'text-red-600 bg-red-100';
      case 'PENDING':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }
}

export const auditLogService = new AuditLogService();