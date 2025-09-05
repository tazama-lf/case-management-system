import { useState, useEffect } from 'react';
import systemConfigService from '../services/systemConfigService';
import type { SystemConfig, TriageType } from '../services/systemConfigService';

export const useSystemConfig = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const systemConfig = await systemConfigService.getSystemConfig();
      setConfig(systemConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system configuration');
      // Set fallback configuration
      setConfig({
        triageType: 'MANUAL',
        confidenceThreshold: 95,
        interdictionEnabled: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const refetchConfig = async () => {
    await fetchConfig();
  };

  return {
    config,
    loading,
    error,
    refetchConfig,
    triageType: config?.triageType || 'MANUAL',
    isAIMode: config?.triageType === 'AI',
    isManualMode: config?.triageType === 'MANUAL',
    isDisabledMode: config?.triageType === 'DISABLED',
  };
};

export const getTriageModeLabel = (triageType: TriageType): string => {
  switch (triageType) {
    case 'AI':
      return 'AI Automated';
    case 'MANUAL':
      return 'Manual Review';
    case 'DISABLED':
      return 'Direct Investigation';
    default:
      return 'Unknown';
  }
};

export const getTriageModeDescription = (triageType: TriageType): string => {
  switch (triageType) {
    case 'AI':
      return 'Alerts are automatically processed using AI predictions with confidence thresholds';
    case 'MANUAL':
      return 'All alerts require manual review and human decision-making';
    case 'DISABLED':
      return 'Alerts bypass triage and go directly to investigation';
    default:
      return 'Unknown triage mode';
  }
};

export const getTriageModeColor = (triageType: TriageType): string => {
  switch (triageType) {
    case 'AI':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'MANUAL':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'DISABLED':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};
