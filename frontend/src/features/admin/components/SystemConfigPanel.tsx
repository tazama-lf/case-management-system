import React, { useState } from 'react';
import { useSystemConfig, useUpdateSystemConfig } from '../hooks/useSystemConfig';
import type { SystemConfig } from '../services/systemConfigService';

interface SystemConfigPanelProps {
  className?: string;
}

const SystemConfigPanel: React.FC<SystemConfigPanelProps> = ({ className = '' }) => {
  const { data: config, isLoading, error, refetch } = useSystemConfig();
  const updateConfigMutation = useUpdateSystemConfig();
  
  const [localConfig, setLocalConfig] = useState<Partial<SystemConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when config is loaded
  React.useEffect(() => {
    if (config) {
      setLocalConfig(config);
      setHasChanges(false);
    }
  }, [config]);

  const handleInputChange = (field: keyof SystemConfig, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    try {
      await updateConfigMutation.mutateAsync(localConfig);
      setHasChanges(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleReset = () => {
    if (config) {
      setLocalConfig(config);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading system configuration...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} p-6`}>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading configuration
              </h3>
              <p className="mt-1 text-sm text-red-700">
                {error.message || 'Failed to load system configuration'}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 bg-red-100 px-3 py-1 text-sm text-red-800 rounded hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} p-6`}>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">System Configuration</h2>
          <p className="mt-1 text-gray-600">
            Manage global system settings for the case management system.
          </p>
        </div>

        <div className="space-y-6">
          {/* Triage Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Triage Type
            </label>
            <select
              value={localConfig.triageType || 'DISABLED'}
              onChange={(e) => handleInputChange('triageType', e.target.value as 'AI' | 'MANUAL' | 'DISABLED')}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="DISABLED">Disabled</option>
              <option value="MANUAL">Manual</option>
              <option value="AI">AI-Powered</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Controls how alerts are triaged in the system.
            </p>
          </div>

          {/* Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Threshold ({localConfig.confidenceThreshold || 95}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={localConfig.confidenceThreshold || 95}
              onChange={(e) => handleInputChange('confidenceThreshold', parseInt(e.target.value))}
              className="block w-full"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Minimum confidence level required for automated decisions.
            </p>
          </div>

          {/* Interdiction Enabled */}
          <div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="interdictionEnabled"
                checked={localConfig.interdictionEnabled || false}
                onChange={(e) => handleInputChange('interdictionEnabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="interdictionEnabled" className="ml-2 block text-sm font-medium text-gray-700">
                Enable Interdiction
              </label>
            </div>
            <p className="mt-1 text-sm text-gray-500 ml-6">
              Allow the system to automatically block suspicious transactions.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={!hasChanges || updateConfigMutation.isPending}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateConfigMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
            
            <button
              onClick={handleReset}
              disabled={!hasChanges || updateConfigMutation.isPending}
              className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>

            {hasChanges && (
              <span className="text-sm text-amber-600">
                * You have unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfigPanel;