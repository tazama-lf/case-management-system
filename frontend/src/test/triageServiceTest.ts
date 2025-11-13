import triageService from '../features/alerts/services/triageservice';
import type { AlertsFilter } from '../features/alerts/types/triage.types';

export const testTriageService = () => {
  const hasGetAlerts = typeof triageService.getAlerts === 'function';
  const hasGetAlertById = typeof triageService.getAlertById === 'function';
  const hasUpdateAlert = typeof triageService.updateAlert === 'function';
  const hasCloseAlert = typeof triageService.closeAlert === 'function';

  return hasGetAlerts && hasGetAlertById && hasUpdateAlert && hasCloseAlert;
};

export const exampleUsage = {
  async getAllAlerts() {
    const filters: AlertsFilter = {};
    return triageService.getAlerts(filters);
  },

  async getFilteredAlerts() {
    const filters: AlertsFilter = {
      priority: 'HIGH',
      status: 'PENDING',
      page: 1,
      limit: 20,
    };
    return triageService.getAlerts(filters);
  },

  async getAlert(id: string) {
    return triageService.getAlertById(id);
  },

  async updateAlert(id: string) {
    return triageService.updateAlert(id, {
      priority: 'URGENT',
      confidence_per: 85,
    });
  },

  async closeAlert(id: string) {
    return triageService.closeAlert(id, 'CLOSED', 'Resolved - false positive');
  },
};
