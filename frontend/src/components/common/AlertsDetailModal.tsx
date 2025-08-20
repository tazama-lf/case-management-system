import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Alert } from '../../types/alertsdashboard.types';
import CloseAlertModal from './CloseAlertModal';
import ConvertToCaseModal, { type ConvertToCaseData } from './ConvertToCaseModal';

interface AlertsDetailModalProps {
  alert: Alert | null;
  isOpen: boolean;
  onClose: () => void;
  onConvertToCase?: (alert: Alert, caseData?: ConvertToCaseData) => void;
  onCloseAlert?: (alert: Alert, reason?: string, justification?: string) => void;
}

const AlertsDetailModal: React.FC<AlertsDetailModalProps> = ({
  alert,
  isOpen,
  onClose,
  onConvertToCase,
  onCloseAlert,
}) => {
  const [open, setOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  // Log alert opening
  useEffect(() => {
    if (alert && isOpen) {
      const logAlertView = () => {
        const currentUser = 'John Doe'; // In real implementation, get from auth context
        const timestamp = new Date().toISOString();

        console.log('Alert View Logged:', {
          alertId: alert.id,
          viewedBy: currentUser,
          viewedAt: timestamp,
          action: 'alert_opened',
        });

        // In real implementation, send to audit service
        // auditService.logAction({
        //   alertId: alert.id,
        //   userId: currentUser,
        //   action: 'alert_opened',
        //   timestamp: timestamp
        // });
      };

      logAlertView();
    }
  }, [alert, isOpen]);

  const handleConvert = () => {
    console.log('handleConvert called, alert status:', alert?.status);
    // Only show convert modal if alert is in an open state
    if (alert && (alert.status === 'new' || alert.status === 'investigating')) {
      console.log('Setting showConvertModal to true');
      setShowConvertModal(true);
    } else {
      console.log('Alert cannot be converted in current status:', alert?.status);
    }
  };

  const handleConfirmConvert = async (caseData: ConvertToCaseData) => {
    try {
      // Call the parent's onConvertToCase with additional parameters
      if (alert && onConvertToCase) {
        await onConvertToCase(alert, caseData);
      }
      setShowConvertModal(false);
      setOpen(false);
      onClose();
    } catch (error) {
      console.error('Error converting alert to case:', error);
      // Keep modal open to show error
      throw error;
    }
  };

  const handleCloseAlert = () => {
    console.log('handleCloseAlert called, alert status:', alert?.status);
    // Only show close modal if alert is in an open state
    if (alert && (alert.status === 'new' || alert.status === 'investigating')) {
      console.log('Setting showCloseModal to true');
      setShowCloseModal(true);
    } else {
      console.log('Alert cannot be closed in current status:', alert?.status);
    }
  };

  const handleConfirmCloseAlert = async (_alertId: string, reason: string, justification: string) => {
    try {
      // Call the parent's onCloseAlert with additional parameters
      if (alert && onCloseAlert) {
        // Pass the additional closure information
        await onCloseAlert(alert, reason, justification);
      }
      setShowCloseModal(false);
      setOpen(false);
      onClose();
    } catch (error) {
      console.error('Error closing alert:', error);
      // Keep modal open to show error
      throw error;
    }
  };

  // Don't render if not open or no alert
  if (!isOpen || !alert) {
    return null;
  }

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 opacity-20 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        {/* This element is to trick the browser into centering the modal contents */}
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        {/* Modal panel */}
        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl sm:w-full">
          {/* Close button */}
          <div className="absolute top-0 right-0 pt-4 pr-4 z-10">
            <button
              onClick={onClose}
              className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Modal content */}
          <div className="bg-white px-6 pt-6 pb-6 max-h-[90vh] overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              {/* Header Section */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">
                      Alert Details
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}
                    >
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-lg text-gray-600 mb-1">{alert.title}</p>
                  <p className="text-sm text-gray-500">
                    Alert ID: {alert.id} • Transaction: {alert.transactionId}
                  </p>
                </div>

                {/* Actions dropdown */}
                <div className="relative ml-4">
                  <button
                    onClick={() => {
                      console.log('Actions button clicked, current open state:', open);
                      setOpen(!open);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Actions
                    <svg
                      className="ml-2 h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.12 1.0l-4.25 4.65a.75.75 0 01-1.12 0L5.21 8.29a.75.75 0 01.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {open && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-40">
                      <div className="py-1">
                        {/* Only show Convert to Case if status allows converting */}
                        {(alert?.status === 'new' || alert?.status === 'investigating') && (
                          <button
                            onClick={() => {
                              console.log('Convert to Case button clicked');
                              handleConvert();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Convert to Case
                          </button>
                        )}
                        {/* Only show Close Alert if status allows closing */}
                        {(alert?.status === 'new' || alert?.status === 'investigating') && (
                          <button
                            onClick={() => {
                              console.log('Close Alert button clicked');
                              handleCloseAlert();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Close Alert
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 1: Alert Summary & Transaction Data */}
              <div className="bg-white rounded-lg mb-6">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                  {/* Column 1: Alert Summary */}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Alert Summary
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Alert ID:
                        </span>
                        <p className="text-sm text-gray-900">{alert.id}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Risk Score:
                        </span>
                        <p className="text-sm text-gray-900">
                          {alert.riskScore}/100
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Created:
                        </span>
                        <p className="text-sm text-gray-900">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Transaction Data */}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Transaction Data
                    </h4>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Transaction ID:
                        </span>
                        <p className="text-sm text-gray-900 font-mono">
                          {alert.transactionId}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Related Items & Action History */}
              <div className="bg-white rounded-lg mb-6">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                  {/* Column 1: Related Items */}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Related Items
                    </h4>
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-gray-900">
                        Related Item 1
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        Related Item 2
                      </p>
                    </div>
                  </div>

                  {/* Column 2: Action History */}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Action History
                    </h4>
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">Alert opened</span> by
                            John Doe
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date().toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">Alert created</span>{' '}
                            by {alert.source}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {alert.assignee && (
                        <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">
                                Alert assigned
                              </span>{' '}
                              to {alert.assignee}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(alert.updatedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Rules & Typologies */}
              <div className="bg-white rounded-lg p-6 mb-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Rules & Typologies
                  </h4>
                  <button
                    onClick={() => setShowRules(!showRules)}
                    className="text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {showRules ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-500">Triggered Rule:</span>
                    <span className="font-medium text-gray-900">
                      {alert.type}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-500">Typology:</span>
                    <span className="font-medium text-gray-900">
                      Financial Crime Detection
                    </span>
                  </div>
                </div>

                {/* Collapsible detailed rules table */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${showRules ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  {showRules && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Rule/Typology
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Score Contribution
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Confidence
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {alert.type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {alert.riskScore}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {alert.confidence}%
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              Source System Validation
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              +5
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              85%
                            </td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              Total Score
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {alert.riskScore}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {alert.confidence}%
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Close Alert Modal */}
      {alert && (
        <CloseAlertModal
          isOpen={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          alert={alert}
          onConfirmClose={handleConfirmCloseAlert}
        />
      )}

      {/* Convert to Case Modal */}
      {alert && (
        <ConvertToCaseModal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          alert={alert}
          onConfirmConvert={handleConfirmConvert}
        />
      )}
    </div>
  );
};

export default AlertsDetailModal;
