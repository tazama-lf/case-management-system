import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatDate } from '@/shared/utils/dateUtils';
import { getRiskScoreColorClass, getAlertTypeBadgeColor } from '@/shared/utils/colors';
import triageService from '../../alerts/services/triageservice';
import type { Alert } from '../../alerts/types/triage.types';

interface LinkExistingAlertsTabProps {
  selectedAlerts: Alert[];
  onAlertsChange: (alerts: Alert[]) => void;
  isVisible: boolean;
  onAlertsSelected?: (hasAlerts: boolean) => void;
}

const LinkExistingAlertsTab: React.FC<LinkExistingAlertsTabProps> = ({
  selectedAlerts,
  onAlertsChange,
  isVisible,
  onAlertsSelected
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableAlerts, setAvailableAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (onAlertsSelected) {
      onAlertsSelected(selectedAlerts.length > 0);
    }
  }, [selectedAlerts, onAlertsSelected]);

  useEffect(() => {
    if (!isVisible) return;

    const loadNALTAlerts = async () => {
      setIsLoading(true);
      try {
        const alerts = await triageService.getNALTAlerts(searchTerm);
        setAvailableAlerts(alerts);
      } catch (error) {
        console.error('Failed to load NALT alerts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(loadNALTAlerts, 300);
    return () => clearTimeout(timeoutId);
  }, [isVisible, searchTerm]);

  const handleAlertToggle = (alert: Alert) => {
    const isSelected = selectedAlerts.some(a => a.alert_id === alert.alert_id);
    if (isSelected) {
      onAlertsChange(selectedAlerts.filter(a => a.alert_id !== alert.alert_id));
    } else {
      onAlertsChange([...selectedAlerts, alert]);
    }
  };

  const isAlertSelected = (alert: Alert) => {
    return selectedAlerts.some(a => a.alert_id === alert.alert_id);
  };

  const filteredAlerts = React.useMemo(() => {
    if (!searchTerm || searchTerm.length < 1) {
      return availableAlerts.slice(0, 50);
    }

    const searchTermLower = searchTerm.toLowerCase();

    return availableAlerts.filter(alert => {
      const alertIdMatch = alert.alert_id.toLowerCase().includes(searchTermLower);

      const typeMatch = (alert.txtp && alert.txtp.toLowerCase().includes(searchTermLower)) ||
                       (alert.alert_type && alert.alert_type.toLowerCase().includes(searchTermLower)) ||
                       (searchTermLower === 'fraud' && (alert.txtp?.toLowerCase().includes('fraud') || alert.alert_type?.toLowerCase().includes('fraud'))) ||
                       (searchTermLower === 'aml' && (alert.txtp?.toLowerCase().includes('aml') || alert.alert_type?.toLowerCase().includes('aml'))) ||
                       (searchTermLower.includes('fraud') && searchTermLower.includes('aml') &&
                        ((alert.txtp?.toLowerCase().includes('fraud') && alert.txtp?.toLowerCase().includes('aml')) ||
                         (alert.alert_type?.toLowerCase().includes('fraud') && alert.alert_type?.toLowerCase().includes('aml'))));

      const descriptionMatch = alert.description &&
                              typeof alert.description === 'string' &&
                              alert.description.toLowerCase().includes(searchTermLower);

      const sourceMatch = alert.source && alert.source.toLowerCase().includes(searchTermLower);

      return alertIdMatch || typeMatch || descriptionMatch || sourceMatch;
    }).sort((a, b) => {
      const aId = a.alert_id.toLowerCase();
      const bId = b.alert_id.toLowerCase();
      const search = searchTermLower;

      const aIdStartsWith = aId.startsWith(search);
      const bIdStartsWith = bId.startsWith(search);

      if (aIdStartsWith && !bIdStartsWith) return -1;
      if (!aIdStartsWith && bIdStartsWith) return 1;

      return aId.localeCompare(bId);
    }).slice(0, 50);
  }, [availableAlerts, searchTerm]);

  if (!isVisible) return null;

  return (
    <div className="space-y-4">
      {}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Link Existing Alerts</h3>
          <p className="text-sm text-gray-500">
            Search and select NALT status alerts to link to this case
          </p>
        </div>
        {selectedAlerts.length > 0 && (
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            {selectedAlerts.length} alert{selectedAlerts.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by Alert ID, type, or description..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
        <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
      </div>

      {}
      {selectedAlerts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedAlerts.length} alert{selectedAlerts.length !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => onAlertsChange([])}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Clear all
            </button>
          </div>
          <div className="mt-1 text-xs text-blue-700">
            Selected alerts will be linked to this case
          </div>
        </div>
      )}

      {}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alert ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    Loading alerts...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No alerts found
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={alert.alert_id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      isAlertSelected(alert) ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleAlertToggle(alert)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isAlertSelected(alert)}
                        onChange={() => handleAlertToggle(alert)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {alert.alert_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        getAlertTypeBadgeColor(alert.txtp || alert.alert_type || 'Unknown')
                      }`}>
                        {alert.txtp || alert.alert_type || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        getRiskScoreColorClass(alert.priority || 0)
                      }`}>
                        {alert.priority || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {alert.created_at ? formatDate(alert.created_at) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {}
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <div className="flex">
          <div className="ml-3">
            <div className="text-sm text-yellow-800">
              <strong>Note:</strong> Selected alerts will be linked to this case.
              You can manage linked alerts after case creation from the case details page.
              {selectedAlerts.length > 0 && (
                <p className="mt-1 font-medium">The Create Case button is now enabled. Click it to create a case with the first selected alert.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkExistingAlertsTab;