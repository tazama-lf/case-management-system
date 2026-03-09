import { useState, useCallback } from 'react';
import triageService from '../services/triageservice';
import type { Alert } from '../types/alertsdashboard.types';
import type { AlertStatus } from '../types/triage.types';

interface OperationStates {
  convertingToCase: Set<string>;
  closingAlert: Set<string>;
  updatingAlert: Set<string>;
  loadingDetails: Set<string>;
}

export const useAlertOperations = (refreshAlerts: () => void): {
  operationStates: OperationStates;
  handleCloseAlert: (alert: Alert, status: AlertStatus, notes: string) => Promise<void>;
} => {
  const [operationStates, setOperationStates] = useState<OperationStates>({
    convertingToCase: new Set(),
    closingAlert: new Set(),
    updatingAlert: new Set(),
    loadingDetails: new Set(),
  });

  const handleCloseAlert = useCallback(
    async (alert: Alert, status: AlertStatus, notes: string) => {
      const alertId = alert.alert_id;
      setOperationStates((prev) => ({
        ...prev,
        closingAlert: new Set(prev.closingAlert).add(alertId.toString()),
      }));
      try {
        await triageService.closeAlert(alertId, status, notes);
        refreshAlerts();
      } catch (error) {
        console.error('Error closing alert:', error);
        throw error;
      } finally {
        setOperationStates((prev) => {
          const newSet = new Set(prev.closingAlert);
          newSet.delete(alertId.toString());
          return { ...prev, closingAlert: newSet };
        });
      }
    },
    [refreshAlerts],
  );

  return {
    operationStates,
    handleCloseAlert,
  };
};
