
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

export const useAlertOperations = (refreshAlerts: () => void) => {
  const [operationStates, setOperationStates] = useState<OperationStates>({
    convertingToCase: new Set(),
    closingAlert: new Set(),
    updatingAlert: new Set(),
    loadingDetails: new Set(),
  });

  const handleCloseAlert = useCallback(async (alert: Alert, status: AlertStatus, notes: string) => {
    const alertId = alert.alert_id as string;
    setOperationStates(prev => ({ ...prev, closingAlert: new Set(prev.closingAlert).add(alertId) }));
    try {
      await triageService.closeAlert(alertId, status, notes);
      refreshAlerts();
    } catch (error) {
      console.error('Error closing alert:', error);
      // Here you would typically show a toast notification
      throw error;
    } finally {
      setOperationStates(prev => {
        const newSet = new Set(prev.closingAlert);
        newSet.delete(alertId);
        return { ...prev, closingAlert: newSet };
      });
    }
  }, [refreshAlerts]);

  return {
    operationStates,
    handleCloseAlert,
  };
};
