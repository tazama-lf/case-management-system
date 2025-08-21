import triageService from '../services/triageservice';
import type { AlertsFilter } from '../types/triage.types';

// This file just tests that our service can be imported and used
export const testTriageService = () => {
  // Test that all methods exist
  const hasGetAlerts = typeof triageService.getAlerts === 'function';
  const hasGetAlertById = typeof triageService.getAlertById === 'function';
  const hasUpdateAlert = typeof triageService.updateAlert === 'function';
  const hasCloseAlert = typeof triageService.closeAlert === 'function';
  const hasConvertAlertToCase = typeof triageService.convertAlertToCase === 'function';

  console.log('TriageService Methods Available:', {
    getAlerts: hasGetAlerts,
    getAlertById: hasGetAlertById,
    updateAlert: hasUpdateAlert,
    closeAlert: hasCloseAlert,
    convertAlertToCase: hasConvertAlertToCase
  });

  return hasGetAlerts && hasGetAlertById && hasUpdateAlert && hasCloseAlert && hasConvertAlertToCase;
};

// Example usage patterns
export const exampleUsage = {
  // Get all alerts
  async getAllAlerts() {
    const filters: AlertsFilter = {};
    return triageService.getAlerts(filters);
  },

  // Get alerts with filters
  async getFilteredAlerts() {
    const filters: AlertsFilter = {
      priority: 'HIGH',
      status: 'PENDING',
      page: 1,
      limit: 20
    };
    return triageService.getAlerts(filters);
  },

  // Get specific alert
  async getAlert(id: string) {
    return triageService.getAlertById(id);
  },

  // Update alert
  async updateAlert(id: string) {
    return triageService.updateAlert(id, {
      priority: 'MEDIUM',
      confidence_per: 85
    });
  },

  // Close alert
  async closeAlert(id: string) {
    return triageService.closeAlert(id, 'Resolved - false positive');
  },

  // Convert to case
  async convertToCase(id: string) {
    return triageService.convertAlertToCase(id, {
      priority: 'MEDIUM',
      caseType: 'INVESTIGATION'
    });
  }
};
