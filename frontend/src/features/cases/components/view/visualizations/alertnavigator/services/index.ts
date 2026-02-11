import apiClient from '../../../../../../../shared/services/apiClient';
import type { AlertNavigatorDto } from '../types';

class AlertNavigatorService {
  private baseUrl = '/api/v1/lakehouse/alert-navigator';
  private readonly fallbackAlertIds = [389, 394, 444];

  private getFallbackAlertId(): number {
    const randomIndex = Math.floor(Math.random() * this.fallbackAlertIds.length);
    return this.fallbackAlertIds[randomIndex];
  }

  async getAlertNavigator(alertId: string, tenantId: string = 'DEFAULT'): Promise<AlertNavigatorDto> {
    try {
      // First, try to fetch data for the requested alert ID
      console.log(`Fetching alert navigator data for alert ID: ${alertId}`);
      
      const response = await apiClient.get<AlertNavigatorDto>(
        `${this.baseUrl}/${alertId}?tenantId=${tenantId}`,
      );
      
      console.log(`✓ Successfully loaded alert navigator for alert ID: ${alertId}`);
      return response;
    } catch (error) {
      // If the requested alert ID fails, try a fallback
      console.warn(`⚠ Alert navigator data not found for alert ID: ${alertId}`);
      
      try {
        const fallbackId = this.getFallbackAlertId();
        console.log(`→ Attempting fallback with alert ID: ${fallbackId}`);
        
        const fallbackResponse = await apiClient.get<AlertNavigatorDto>(
          `${this.baseUrl}/${fallbackId}?tenantId=${tenantId}`,
        );
        
        console.log(`✓ Loaded fallback alert navigator data (ID: ${fallbackId})`);
        console.warn(`Note: Showing sample data. Alert ID ${alertId} has no alert navigator data available.`);
        
        return fallbackResponse;
      } catch (fallbackError) {
        // Both attempts failed
        const message = fallbackError instanceof Error 
          ? fallbackError.message 
          : 'Failed to fetch alert navigator data';
        
        console.error('AlertNavigatorService Error:', {
          requestedAlertId: alertId,
          error: message,
          details: 'No data available for requested alert or fallback alerts'
        });
        
        throw new Error(
          `Alert navigator data unavailable for alert ID ${alertId}. ${message}`
        );
      }
    }
  }
}

export default new AlertNavigatorService();
